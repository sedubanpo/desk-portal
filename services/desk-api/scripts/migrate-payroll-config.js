#!/usr/bin/env node

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizePayrollOverrideBundle, normalizePayrollSettings } from '../src/payroll/normalizers.js';
import { payrollOverrideDocumentId } from '../src/payroll/store.js';

const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXTWtznXXr8cF_x7BhyNWKb6KkfYFzUHbnWFLwdyZhmIgAHkOFvHYtmHMPJ-Rdv2kn/exec';
const DEFAULT_DATABASE_URL = 'https://sedu-portal-default-rtdb.firebaseio.com';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function json(url, label) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}.`);
  const data = await response.json();
  if (data?.success === false) throw new Error(`${label} failed: ${data.message || 'unknown error'}`);
  return data;
}

function legacySettingsUrl() {
  const url = new URL(process.env.LEGACY_APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL);
  url.searchParams.set('mode', 'api');
  url.searchParams.set('fn', 'getPayrollSettings');
  url.searchParams.set('portalKey', required('LEGACY_PORTAL_KEY'));
  url.searchParams.set('privilegedKey', required('LEGACY_PRIVILEGED_KEY'));
  return url;
}

function legacyOverridesUrl() {
  const base = String(process.env.LEGACY_FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL).replace(/\/+$/, '');
  const url = new URL(`${base}/payroll/months.json`);
  url.searchParams.set('auth', required('LEGACY_FIREBASE_SECRET'));
  return url;
}

function payrollOverrides(months) {
  return Object.entries(months || {}).flatMap(([monthName, month]) => {
    const current = month?.overrides?.current;
    return current && typeof current === 'object'
      ? [{ monthName: decodeURIComponent(monthName), overrides: normalizePayrollOverrideBundle(current) }]
      : [];
  });
}

async function main() {
  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT or FIREBASE_PROJECT_ID is required.');

  const [settingsResponse, monthsResponse] = await Promise.all([
    json(legacySettingsUrl(), 'Legacy payroll settings read'),
    json(legacyOverridesUrl(), 'Legacy payroll overrides read')
  ]);
  const settings = normalizePayrollSettings(settingsResponse.settings || {});
  const overrides = payrollOverrides(monthsResponse);
  const migratedAt = new Date().toISOString();

  const app = initializeApp({ credential: applicationDefault(), projectId }, `payroll-config-migration-${Date.now()}`);
  const firestore = getFirestore(app);
  const batch = firestore.batch();
  batch.set(firestore.collection('payrollSettings').doc('global'), {
    settings,
    migratedAt,
    migrationSource: 'apps-script-properties',
    migrationVersion: 'v1'
  }, { merge: true });
  overrides.forEach(({ monthName, overrides: value }) => {
    batch.set(firestore.collection('payrollOverrides').doc(payrollOverrideDocumentId(monthName)), {
      monthName,
      overrides: value,
      migratedAt,
      migrationSource: 'legacy-rtdb',
      migrationVersion: 'v1'
    }, { merge: true });
  });
  await batch.commit();

  const teacherCount = Object.keys(settings).filter(key => key !== '__suspicionRules').length;
  process.stdout.write(JSON.stringify({ success: true, teacherCount, overrideMonthCount: overrides.length, migratedAt }) + '\n');
}

main().catch(error => {
  process.stderr.write(`Payroll configuration migration failed: ${error.message}\n`);
  process.exitCode = 1;
});

#!/usr/bin/env node

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createGoogleWorkspaceReader } from '../src/google-workspace.js';
import { buildPayrollSummary, parsePayrollMonthName, parsePayrollRows, payrollOptions } from '../src/payroll/normalizers.js';
import { createPayrollStore } from '../src/payroll/store.js';

const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXTWtznXXr8cF_x7BhyNWKb6KkfYFzUHbnWFLwdyZhmIgAHkOFvHYtmHMPJ-Rdv2kn/exec';
const DEFAULT_SPREADSHEET_ID = '1RelndJgXn0yMNSg41Pyy1yDV6zjehG2ljMuue5pod1E';
const KPI_KEYS = Object.freeze([
  'totalLessons', 'recognizedLessons', 'recognizedHours', 'pureTeachingHours',
  'grossSales', 'discount', 'netSales', 'canceledAmount', 'workingDays', 'estimatedPay'
]);

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function legacySummary(payload) {
  const url = new URL(process.env.LEGACY_APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL);
  url.searchParams.set('mode', 'api');
  url.searchParams.set('fn', 'getPayrollMonthSummary');
  url.searchParams.set('portalKey', required('LEGACY_PORTAL_KEY'));
  url.searchParams.set('privilegedKey', required('LEGACY_PRIVILEGED_KEY'));
  url.searchParams.set('payload', JSON.stringify(payload));
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Legacy payroll read failed with HTTP ${response.status}.`);
  const data = await response.json();
  if (!data?.success) throw new Error(`Legacy payroll read failed: ${data?.message || 'unknown error'}`);
  return data;
}

async function main() {
  const projectId = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT or FIREBASE_PROJECT_ID is required.');
  const serviceAccountEmail = required('GOOGLE_WORKSPACE_SERVICE_ACCOUNT');
  const workspace = createGoogleWorkspaceReader({
    spreadsheetId: process.env.PAYROLL_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID,
    serviceAccountEmail
  });
  const months = await workspace.listPayrollMonths();
  const monthName = String(process.env.PAYROLL_PARITY_MONTH || months[0] || '').trim();
  const monthMeta = parsePayrollMonthName(monthName);
  if (!monthMeta) throw new Error(`No valid payroll month was found: ${monthName}`);
  const payload = { monthName, salaryMode: 'ratio', ratioPercent: 50, hourlyRate: 0, forceRefresh: true };

  const app = initializeApp({ credential: applicationDefault(), projectId }, `payroll-parity-${Date.now()}`);
  const store = createPayrollStore(getFirestore(app));
  const [legacy, source, settings, overrides] = await Promise.all([
    legacySummary(payload),
    workspace.readPayrollMonth(monthName),
    store.getSettings(),
    store.getOverrides(monthName)
  ]);
  const rows = parsePayrollRows(source, monthMeta);
  const cloud = buildPayrollSummary(rows, monthMeta, payrollOptions(payload, settings, overrides));
  const differences = KPI_KEYS.flatMap(key => legacy.kpi?.[key] === cloud.kpi?.[key]
    ? []
    : [{ key, legacy: legacy.kpi?.[key], cloud: cloud.kpi?.[key] }]);
  if ((legacy.rows || []).length !== cloud.rows.length) {
    differences.push({ key: 'rows.length', legacy: (legacy.rows || []).length, cloud: cloud.rows.length });
  }
  process.stdout.write(JSON.stringify({
    success: differences.length === 0,
    monthName,
    checkedKpis: KPI_KEYS.length,
    legacyRows: (legacy.rows || []).length,
    cloudRows: cloud.rows.length,
    differences
  }) + '\n');
  if (differences.length) process.exitCode = 2;
}

main().catch(error => {
  process.stderr.write(`Payroll parity check failed: ${error.message}\n`);
  process.exitCode = 1;
});

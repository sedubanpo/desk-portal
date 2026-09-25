import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { createDeskHandlers } from './desk/handlers.js';
import { createDeskStore } from './desk/store.js';
import { createSubscriptionBilling } from './desk/subscription-billing.js';
import { createIdempotencyExecutor } from './idempotency.js';
import { createTuitionHandlers } from './tuition/handlers.js';
import { createTuitionStore } from './tuition/store.js';
import { createGoogleWorkspaceReader } from './google-workspace.js';
import { createPayrollHandlers } from './payroll/handlers.js';
import { createIntranetPayrollReader } from './payroll/intranet.js';
import { createPayrollStore } from './payroll/store.js';

function firebaseApp(projectId) {
  if (getApps().length) return getApps()[0];
  return initializeApp(projectId ? { projectId } : undefined);
}

export function createFirebaseDependencies({ projectId, checkRevokedTokens, legacyRtdbUrl, payrollSpreadsheetId, deskCalendarId, workspaceServiceAccountEmail, subscriptionBillingTable, subscriptionFirebaseProjectIds, subscriptionSupabaseToken, subscriptionSupabaseOrgSlugs }) {
  const app = firebaseApp(projectId);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  const legacyApp = legacyFirebaseApp(legacyRtdbUrl);
  const legacyDatabase = getDatabase(legacyApp);
  const workspace = createGoogleWorkspaceReader({
    spreadsheetId: payrollSpreadsheetId,
    calendarId: deskCalendarId,
    serviceAccountEmail: workspaceServiceAccountEmail
  });

  return {
    training: { firestore, bucket: getStorage(app).bucket('fir-lms-prod-training-evidence') },
    verifyIdToken: token => auth.verifyIdToken(token, checkRevokedTokens),
    loadAccount: async uid => {
      const [accountSnapshot, accessSnapshot] = await Promise.all([
        firestore.collection('users').doc(uid).get(),
        firestore.collection('userAppAccess').doc(uid).get()
      ]);
      return {
        account: accountSnapshot.exists ? accountSnapshot.data() : null,
        access: accessSnapshot.exists ? accessSnapshot.data() : null
      };
    },
    deskHandlers: {
      ...createDeskHandlers({
        store: createDeskStore(legacyDatabase),
        loadStaffDirectory: () => loadStaffDirectory(firestore),
        subscriptionBilling: createSubscriptionBilling({
          table: subscriptionBillingTable,
          firebaseProjectIds: subscriptionFirebaseProjectIds,
          supabaseToken: subscriptionSupabaseToken,
          supabaseOrgSlugs: subscriptionSupabaseOrgSlugs
        })
      }),
      getDeskCalendarEvents: workspace.getDeskCalendarEvents,
      ...createTuitionHandlers({ store: createTuitionStore(firestore) }),
      ...createPayrollHandlers({ store: createPayrollStore(firestore), sheets: workspace, intranet:createIntranetPayrollReader(firestore) })
    },
    runIdempotent: createIdempotencyExecutor(firestore)
  };
}

async function loadStaffDirectory(firestore) {
  const [usersSnapshot, profilesSnapshot] = await Promise.all([
    firestore.collection('users').get(),
    firestore.collection('userProfiles').get()
  ]);
  const profiles = new Map(profilesSnapshot.docs.map(doc => [doc.id, doc.data() || {}]));
  return usersSnapshot.docs.map(doc => {
    const user = doc.data() || {};
    const profile = profiles.get(doc.id) || {};
    return {
      uid: doc.id,
      role: String(user.role || '').toUpperCase(),
      status: String(user.status || 'ACTIVE').toUpperCase(),
      name: user.name || profile.displayName || '',
      staffPosition: user.staffPosition || profile.staffPosition || ''
    };
  }).filter(item => item.role === 'STAFF');
}

function legacyFirebaseApp(databaseURL) {
  if (!databaseURL) throw new Error('LEGACY_RTDB_URL is required.');
  try {
    return getApp('legacy-rtdb');
  } catch {
    return initializeApp({ credential: applicationDefault(), databaseURL }, 'legacy-rtdb');
  }
}

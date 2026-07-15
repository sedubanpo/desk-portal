import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { createDeskHandlers } from './desk/handlers.js';
import { createDeskStore } from './desk/store.js';
import { createIdempotencyExecutor } from './idempotency.js';
import { createTuitionHandlers } from './tuition/handlers.js';
import { createTuitionStore } from './tuition/store.js';
import { createGoogleWorkspaceReader } from './google-workspace.js';
import { createPayrollHandlers } from './payroll/handlers.js';
import { createPayrollStore } from './payroll/store.js';

function firebaseApp(projectId) {
  if (getApps().length) return getApps()[0];
  return initializeApp(projectId ? { projectId } : undefined);
}

export function createFirebaseDependencies({ projectId, checkRevokedTokens, legacyRtdbUrl, payrollSpreadsheetId, deskCalendarId, workspaceServiceAccountEmail }) {
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
      ...createDeskHandlers({ store: createDeskStore(legacyDatabase) }),
      getDeskCalendarEvents: workspace.getDeskCalendarEvents,
      ...createTuitionHandlers({ store: createTuitionStore(firestore) }),
      ...createPayrollHandlers({ store: createPayrollStore(firestore), sheets: workspace })
    },
    runIdempotent: createIdempotencyExecutor(firestore)
  };
}

function legacyFirebaseApp(databaseURL) {
  if (!databaseURL) throw new Error('LEGACY_RTDB_URL is required.');
  try {
    return getApp('legacy-rtdb');
  } catch {
    return initializeApp({ credential: applicationDefault(), databaseURL }, 'legacy-rtdb');
  }
}

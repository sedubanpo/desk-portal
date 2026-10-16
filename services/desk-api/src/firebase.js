import {createOffice} from './desk/office.js';
import { createFollowupJournalSync } from './followup/journal-sync.js';
import { createPayrollExportHandler } from './payroll/export-handler.js';
import { createWorkforceHandlers } from './payroll/workforce.js';
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

export function createFirebaseDependencies({ projectId, checkRevokedTokens, legacyRtdbUrl, payrollSpreadsheetId, deskCalendarId, workspaceServiceAccountEmail, subscriptionBillingTable, subscriptionFirebaseProjectIds, subscriptionSupabaseToken, subscriptionSupabaseOrgSlugs, notionInquiryToken, notionInquirySourceId, notionInquiryHistoryId, notionInquirySyncKey, notionFollowupToken, notionFollowupSourceId }) {
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

  const payroll=createPayrollHandlers({store:createPayrollStore(firestore),sheets:workspace,intranet:createIntranetPayrollReader(firestore)});
  const workforce=createWorkforceHandlers({firestore,deskStore:createDeskStore(legacyDatabase),loadStaffDirectory:()=>loadStaffDirectory(firestore)});
  const tuitionStore=createTuitionStore(firestore);
  const office=createOffice({store:createDeskStore(legacyDatabase),loadStaffDirectory:()=>loadStaffDirectory(firestore,['ADMIN','STAFF','DESK'])});
  return {
    office,
    followup: { firestore, token: notionFollowupToken, sourceId: notionFollowupSourceId, loadStaffDirectory: () => loadStaffDirectory(firestore), journalSync: createFollowupJournalSync({store:createDeskStore(legacyDatabase),loadStaffDirectory:()=>loadStaffDirectory(firestore)}) },
    inquiries: { firestore, token: notionInquiryToken, sourceId: notionInquirySourceId, historySourceId: notionInquiryHistoryId, syncKey: notionInquirySyncKey },
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
      getDeskOfficeHistory: p=>office.history(p),
      getDeskOffice: p=>office.snapshot(p.dateKey),
      saveDeskOffice: (p,actor)=>office.mutate(p,actor),
      ...createDeskHandlers({
        store: createDeskStore(legacyDatabase),
        loadStaffDirectory: () => loadStaffDirectory(firestore),
        loadRewardStudents: async () => {
          const snapshot = await firestore.collection('students').get();
          return snapshot.docs.map(doc => ({...doc.data(),id:doc.id})).filter(s => !s.isAlias && s.identityStatus !== 'ALIAS' && s.active !== false && s.isActive !== false && !/^(INACTIVE|DISABLED|DELETED|STOPPED|WITHDRAWN|PAUSED|중지|중지생|퇴원|퇴원생|휴원|휴원생|비활성|삭제)$/.test(String(s.status || s.registrationStatus || s.enrollmentStatus || '').toUpperCase()) && (s.active === true || s.isActive === true || /^(ACTIVE|REGISTERED|ENROLLED|CURRENT|RETURNING|재원|재원생|등록)$/.test(String(s.status || s.registrationStatus || s.enrollmentStatus || '').toUpperCase()))).map(s => ({id:s.id,name:s.name || s.studentName || '',school:s.school || '',grade:String(s.grade || '')})).filter(s=>s.name).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
        },
        loadStaffIcons: async () => {
          const snapshot = await firestore.collection("sharedIconAssets").where("category", "==", "PERSON").get();
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(asset => (asset.status || "ACTIVE") === "ACTIVE" && /^https:\/\//.test(asset.imageUrl || asset.downloadURL || "")).map(asset => ({ category: "PERSON", status: "ACTIVE", lookupKey: asset.lookupKey || "", displayName: asset.displayName || "", aliases: Array.isArray(asset.aliases) ? asset.aliases : [], imageUrl: asset.imageUrl || asset.downloadURL }));
        },
        subscriptionBilling: createSubscriptionBilling({
          table: subscriptionBillingTable,
          firebaseProjectIds: subscriptionFirebaseProjectIds,
          supabaseToken: subscriptionSupabaseToken,
          supabaseOrgSlugs: subscriptionSupabaseOrgSlugs
        })
      }),
      getDeskCalendarEvents: workspace.getDeskCalendarEvents,
      ...createTuitionHandlers({ store: createTuitionStore(firestore) }),
      ...workforce,
      ...payroll,
      getPayrollWorkbookExport:createPayrollExportHandler({payroll,workforce,tuitionStore})
    },
    runIdempotent: createIdempotencyExecutor(firestore)
  };
}

async function loadStaffDirectory(firestore, roles = ['STAFF']) {
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
  }).filter(item => roles.includes(item.role));
}

function legacyFirebaseApp(databaseURL) {
  if (!databaseURL) throw new Error('LEGACY_RTDB_URL is required.');
  try {
    return getApp('legacy-rtdb');
  } catch {
    return initializeApp({ credential: applicationDefault(), databaseURL }, 'legacy-rtdb');
  }
}

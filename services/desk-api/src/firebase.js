import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function firebaseApp(projectId) {
  if (getApps().length) return getApps()[0];
  return initializeApp(projectId ? { projectId } : undefined);
}

export function createFirebaseDependencies({ projectId, checkRevokedTokens }) {
  const app = firebaseApp(projectId);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

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
    }
  };
}

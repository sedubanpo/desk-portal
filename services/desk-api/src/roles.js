export const STAFF_ROLES = new Set(['ADMIN', 'STAFF', 'DESK', 'INSTRUCTOR']);

export function normalizeRole(value) {
  return String(value || '').trim().toUpperCase();
}

export function resolveRole(decodedToken, account) {
  const accountRole = normalizeRole(account?.role);
  if (accountRole) return accountRole;
  if (decodedToken?.isAdmin === true) return 'ADMIN';
  return normalizeRole(decodedToken?.role);
}

export function isActiveAccount(account) {
  return String(account?.status || '').trim().toUpperCase() === 'ACTIVE';
}

export function hasDeskPortalAccess(access) {
  return access?.apps?.deskPortal === true;
}

function publicBooleanMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, enabled]) => typeof enabled === 'boolean')
      .map(([key, enabled]) => [key, enabled])
  );
}

export function publicIdentity(decodedToken, account, access) {
  const role = resolveRole(decodedToken, account);
  return {
    uid: decodedToken.uid,
    email: decodedToken.email || account.email || '',
    loginId: account.loginId || '',
    name: account.name || decodedToken.name || '',
    role,
    status: account.status,
    staffPosition: account.staffPosition || '',
    apps: publicBooleanMap(access?.apps),
    permissions: publicBooleanMap(access?.permissions)
  };
}

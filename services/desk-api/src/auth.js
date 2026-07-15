import { ApiError } from './http.js';
import {
  hasDeskPortalAccess,
  isActiveAccount,
  publicIdentity,
  resolveRole,
  STAFF_ROLES
} from './roles.js';

function bearerToken(req) {
  const authorization = String(req.get('authorization') || '').trim();
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : '';
}

export function createRequireStaff({ verifyIdToken, loadAccount }) {
  if (typeof verifyIdToken !== 'function' || typeof loadAccount !== 'function') {
    throw new TypeError('verifyIdToken and loadAccount are required.');
  }

  return async function requireStaff(req, _res, next) {
    const token = bearerToken(req);
    if (!token) {
      return next(new ApiError(401, 'authentication_required', '로그인이 필요합니다.'));
    }

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
    } catch {
      return next(new ApiError(401, 'invalid_id_token', '로그인 정보가 만료되었거나 유효하지 않습니다.'));
    }

    let accountBundle;
    try {
      accountBundle = await loadAccount(decodedToken.uid);
    } catch (error) {
      return next(new ApiError(503, 'account_lookup_unavailable', '계정 권한을 확인할 수 없습니다.', { cause: error }));
    }

    const account = accountBundle?.account;
    if (!account) {
      return next(new ApiError(403, 'account_not_registered', '등록된 근무자 계정이 아닙니다.'));
    }
    if (!isActiveAccount(account)) {
      return next(new ApiError(403, 'account_inactive', '비활성화된 계정입니다.'));
    }

    const role = resolveRole(decodedToken, account);
    if (!STAFF_ROLES.has(role)) {
      return next(new ApiError(403, 'staff_access_required', '데스크 포털 접근 권한이 없습니다.'));
    }
    if (!hasDeskPortalAccess(accountBundle.access)) {
      return next(new ApiError(403, 'desk_portal_access_required', '데스크 포털 사용 권한이 없습니다.'));
    }

    req.identity = publicIdentity(decodedToken, account, accountBundle.access);
    return next();
  };
}

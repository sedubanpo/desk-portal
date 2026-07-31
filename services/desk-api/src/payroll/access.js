import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 30 * 60;
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPayrollAccess({ pin, secret, ttlSeconds = DEFAULT_TTL_SECONDS, now = () => Date.now() }) {
  if (!/^\d{6}$/.test(String(pin || ''))) throw new TypeError('PAYROLL_ACCESS_PIN must be exactly 6 digits.');
  if (String(secret || '').length < 32) throw new TypeError('PAYROLL_UNLOCK_SECRET must be at least 32 characters.');

  const signingSecret = String(secret);
  const failures = new Map();

  function sign(payloadPart) {
    return createHmac('sha256', signingSecret).update(payloadPart).digest('base64url');
  }

  function failureState(key) {
    const current = failures.get(key);
    const timestamp = now();
    if (!current || timestamp - current.firstFailureAt > FAILURE_WINDOW_MS) {
      return { count: 0, firstFailureAt: timestamp, lockedUntil: 0 };
    }
    return current;
  }

  function verifyPin(key, submittedPin) {
    const state = failureState(key);
    const timestamp = now();
    if (state.lockedUntil > timestamp) {
      return { ok: false, lockedUntil: state.lockedUntil };
    }
    if (!/^\d{6}$/.test(String(submittedPin || '')) || !secureEqual(pin, submittedPin)) {
      state.count += 1;
      if (state.count >= MAX_FAILURES) state.lockedUntil = timestamp + LOCKOUT_MS;
      failures.set(key, state);
      return { ok: false, lockedUntil: state.lockedUntil || 0 };
    }
    failures.delete(key);
    return { ok: true };
  }

  function issue(uid) {
    const expiresAt = now() + Math.max(60, Number(ttlSeconds) || DEFAULT_TTL_SECONDS) * 1000;
    const payloadPart = encode(JSON.stringify({ uid: String(uid || ''), exp: expiresAt }));
    return { token: `${payloadPart}.${sign(payloadPart)}`, expiresAt };
  }

  function verify(uid, token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 2 || !secureEqual(sign(parts[0]), parts[1])) return false;
    try {
      const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      return payload.uid === String(uid || '') && Number(payload.exp) > now();
    } catch {
      return false;
    }
  }

  return { verifyPin, issue, verify };
}

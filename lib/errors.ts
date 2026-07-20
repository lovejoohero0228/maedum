// Supabase/네트워크 에러를 사용자에게 보여줄 한국어 문장으로 변환한다.
// raw error(영문 원문, "TypeError: ..." 등)를 alert에 그대로 노출하지 않기 위한 공용 헬퍼.

const AUTH_MESSAGES: { pattern: RegExp; message: string }[] = [
  { pattern: /invalid login credentials/i, message: '이메일 또는 비밀번호가 맞지 않아요. 다시 확인해주세요.' },
  { pattern: /email not confirmed/i, message: '아직 이메일 인증이 안 됐어요. 메일함에서 인증 메일을 확인해주세요.' },
  { pattern: /user already registered/i, message: '이미 가입된 이메일이에요. 로그인해주세요.' },
  { pattern: /rate limit|too many requests/i, message: '잠시 후 다시 시도해주세요. 요청이 너무 잦았어요.' },
  { pattern: /(password|비밀번호).*(6|characters)/i, message: '비밀번호는 6자 이상이어야 해요.' },
  { pattern: /unable to validate email|invalid.*email/i, message: '이메일 형식이 올바르지 않아요.' },
  { pattern: /network|fetch failed|failed to fetch|timeout/i, message: '네트워크 연결을 확인하고 다시 시도해주세요.' },
];

function rawMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

// 로그인/가입 등 인증 에러 → 한국어 안내
export function authErrorMessage(e: unknown): string {
  const raw = rawMessage(e);
  for (const { pattern, message } of AUTH_MESSAGES) {
    if (pattern.test(raw)) return message;
  }
  return '문제가 생겼어요. 잠시 후 다시 시도해주세요.';
}

// 일반 작업 실패 → 한국어 안내 (네트워크 계열만 구분하고 나머지는 공통 문구)
export function friendlyErrorMessage(e: unknown, fallback = '문제가 생겼어요. 잠시 후 다시 시도해주세요.'): string {
  const raw = rawMessage(e);
  if (/network|fetch failed|failed to fetch|timeout/i.test(raw)) {
    return '네트워크 연결을 확인하고 다시 시도해주세요.';
  }
  return fallback;
}

// 이메일 형식 간단 검증 (오타 가입 → 인증 메일 영영 못 받는 사고 방지)
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

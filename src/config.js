// Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
// Authorised JavaScript origins: https://veekash2.github.io
// Authorised redirect URIs:      https://veekash2.github.io/FinancePlannerTracker/
export const CLIENT_ID = '238695325459-lf437vd5l0e6bk5s5p0m3akg1u9hpbfr.apps.googleusercontent.com';

export const SCOPES = 'openid email profile';

// Gemini API — set VITE_GEMINI_API_KEY in GitHub Secrets (Actions) or .env.local for dev
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
export const GEMINI_MODEL   = 'gemini-2.5-flash';

// Claude fallback — set VITE_ANTHROPIC_API_KEY in GitHub Secrets or .env.local
export const ANTHROPIC_API_KEY    = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
export const CLAUDE_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';
export const CLAUDE_MAX_TOKENS     = 4096;

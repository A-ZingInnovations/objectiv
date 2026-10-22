/** Enterprise SSO / billing URLs (A-Zing IdP via project-objectiv.com). */

const SITE = 'https://www.project-objectiv.com';

/** Company admin: buy seats → A-Zing SSO → Razorpay → account dashboard. */
export const ENTERPRISE_BUY_URL = `${SITE}/buy/`;

/** Seat holder / admin account dashboard (requires A-Zing session). */
export const ENTERPRISE_ACCOUNT_URL = `${SITE}/account/`;

/** A-Zing SSO login, then return to Objectiv account (licenses + org). */
export const ENTERPRISE_SSO_LOGIN_URL = `${SITE}/auth/login?return_to=${encodeURIComponent('/account/')}`;

/** A-Zing SSO then company team checkout. */
export const ENTERPRISE_SSO_BUY_URL = `${SITE}/auth/login?return_to=${encodeURIComponent('/buy/')}`;

export const ENTERPRISE_EDITIONS_URL = `${SITE}/docs/editions/`;

/** Company signup — buy flow prompts A-Zing SSO register when needed. */
export const ENTERPRISE_REGISTER_URL = `${SITE}/buy/`;

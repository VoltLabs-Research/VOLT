export const DOCS_URL = 'https://docs.voltcloud.dev';
export const GITHUB_URL = 'https://github.com/VoltLabs-Research/VOLT';

// VOLT is deployed apart from this page, so every way into it is a link to its own origin.
export const VOLT_APP_URL = (import.meta.env.VITE_VOLT_APP_URL?.trim() || 'https://app.voltcloud.dev').replace(/\/+$/, '');
export const SIGN_IN_URL = `${VOLT_APP_URL}/auth/sign-in`;
// Starts VOLT's server and cluster in the visitor's tab, unless that browser already uses a server.
export const RUN_IN_BROWSER_URL = `${VOLT_APP_URL}/connect?run=browser`;

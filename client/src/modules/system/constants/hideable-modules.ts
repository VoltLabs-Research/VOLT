/**
 * Per-user module hiding — the set of module keys a user is NOT allowed to hide.
 *
 * This is the user-facing complement to the deployment-level `enabledModules`
 * switch (server `DeploymentSettings`): a user may hide OPTIONAL feature modules
 * they don't use from their own navigation, but never the core ones the app
 * depends on to function. `dashboard` is the landing page; `trajectory` is the
 * central entity around which VOLT is built. The kernel modules (auth/session/
 * socket/team) and Settings have no `moduleKey` on their routes, so they are
 * never candidates anyway — these two are the only `moduleKey`-bearing routes
 * that must stay protected.
 *
 * `isHideableModule` is enforced both in the Settings UI (what's offered) and in
 * the persisted-state sanitizer (so a tampered localStorage can never hide a
 * protected route).
 */
export const PROTECTED_MODULE_KEYS = ['dashboard', 'trajectory'] as const;

const PROTECTED_MODULE_KEY_SET = new Set<string>(PROTECTED_MODULE_KEYS);

export const isHideableModule = (moduleKey: string | undefined): moduleKey is string => {
    return Boolean(moduleKey) && !PROTECTED_MODULE_KEY_SET.has(moduleKey as string);
};

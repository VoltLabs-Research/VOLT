/**
 * Credentials the local single-machine stack provisions itself with.
 *
 * These are development defaults for a stack bound to the user's own machine, not
 * secrets. They live here because `Bootstrap` and `deploy-local` both need them
 * and had drifting copies.
 */
export const LOCAL_DEFAULTS = {
    fullName: 'Local',
    email: 'local@volt.local',
    password: 'volt-local-desktop',
    teamName: 'Local',
    clusterName: 'Local Cluster'
} as const;

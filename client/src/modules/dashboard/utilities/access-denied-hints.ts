import type { Team } from '@/modules/team/api/types/team/team';

/**
 * Friendly labels for the RBAC permission keys surfaced by dashboard denials.
 * Keys follow the server `<resource>:<action>` convention (see server Resource enum).
 * Unmapped keys fall back to the raw key so the hint is still truthful.
 *
 * NOTE: ideally this map lives in a shared location so every module renders the
 * same permission names. See the report for the recommended shared home.
 */
const PERMISSION_LABELS: Record<string, string> = {
    'trajectory:read': 'View trajectories',
    'analysis:read': 'View analyses',
    'daily-activity:read': 'View team activity',
    'team-member:read': 'View team members',
    'team:read': 'View team',
    'team-role:read': 'View roles',
    'team-secret-key:read': 'View secret keys'
};

/** Maps machine permission keys to human-readable labels for AccessDenied hints. */
export const toPermissionLabels = (keys: string[]): string[] => {
    return keys.map((key) => PERMISSION_LABELS[key] ?? key);
};

/**
 * Builds a "who to ask" hint from the selected team's owner, if that data is
 * already loaded. Returns undefined when no name/email is available so the
 * shared AccessDenied component falls back to its generic prompt.
 */
export const getTeamOwnerContactHint = (team: Team | null | undefined): string | undefined => {
    const owner = team?.owner;
    if (!owner) {
        return undefined;
    }

    const fullName = `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim();
    const displayName = fullName || owner.fullName?.trim() || owner.email;
    if (!displayName) {
        return undefined;
    }

    return `${displayName} (team owner)`;
};

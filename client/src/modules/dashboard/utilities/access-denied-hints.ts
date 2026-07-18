import type { Team } from '@/modules/team/api/types/team/team';

const PERMISSION_LABELS: Record<string, string> = {
    'trajectory:read': 'View trajectories',
    'analysis:read': 'View analyses',
    'daily-activity:read': 'View team activity',
    'team-member:read': 'View team members',
    'team:read': 'View team',
    'team-role:read': 'View roles',
    'team-secret-key:read': 'View secret keys'
};

export const toPermissionLabels = (keys: string[]): string[] => {
    return keys.map((key) => PERMISSION_LABELS[key] ?? key);
};

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

import { TEAM_ROLES, TeamRole, hasTeamRole, teamRoleLabel } from '@volt/contracts/modules/team/access';

export interface TeamRoleOption {
    value: TeamRole;
    title: string;
    description: string;
}

const TEAM_ROLE_DESCRIPTIONS: Readonly<Record<TeamRole, string>> = {
    [TeamRole.Viewer]: 'Sees the team\'s work and changes none of it',
    [TeamRole.Member]: 'Uploads, analyzes and edits the team\'s work',
    [TeamRole.Admin]: 'Also manages members and invitations',
    [TeamRole.Owner]: 'Also manages clusters, keys, integrations and the team'
};

// The roles someone with actorRole may hand out: their own and the ones below it.
export const grantableTeamRoleOptions = (actorRole: TeamRole | null): TeamRoleOption[] =>
    TEAM_ROLES
        .filter((role) => hasTeamRole(actorRole, role))
        .map((role) => ({
            value: role,
            title: teamRoleLabel(role),
            description: TEAM_ROLE_DESCRIPTIONS[role]
        }));

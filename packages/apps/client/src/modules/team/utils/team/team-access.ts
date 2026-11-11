import {
    TeamAccess,
    TeamRole,
    hasTeamRole,
    requiredTeamRole,
    type TeamArea
} from '@volt/contracts/modules/team/access';

// What a page or an action needs: to read or to change one part of the team.
export interface TeamAccessRequirement {
    area: TeamArea;
    access: TeamAccess;
}

export const readAccess = (area: TeamArea): TeamAccessRequirement => ({ area, access: TeamAccess.Read });

export const writeAccess = (area: TeamArea): TeamAccessRequirement => ({ area, access: TeamAccess.Write });

// The lowest role that meets every requirement.
export const roleNeededFor = (requirements: readonly TeamAccessRequirement[]): TeamRole =>
    requirements.reduce<TeamRole>((needed, { area, access }) => {
        const required = requiredTeamRole(area, access);
        return hasTeamRole(needed, required) ? needed : required;
    }, TeamRole.Viewer);

export const meetsTeamAccess = (role: TeamRole | null, requirements: readonly TeamAccessRequirement[] = []): boolean =>
    requirements.length === 0 || hasTeamRole(role, roleNeededFor(requirements));

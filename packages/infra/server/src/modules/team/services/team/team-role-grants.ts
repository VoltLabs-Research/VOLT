import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/errors/ApplicationError';
import { hasTeamRole, teamRoleLabel, type TeamRole } from '@volt/contracts/modules/team/access';

// Nobody hands out a role above their own, so an Admin cannot make an Owner.
export const assertCanGrantTeamRole = (actorRole: TeamRole | undefined, role: TeamRole): void => {
    if (!hasTeamRole(actorRole, role)) {
        throw ApplicationError.forbidden(
            ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS,
            `Giving the ${teamRoleLabel(role)} role needs the ${teamRoleLabel(role)} role or higher`
        );
    }
};

// Nobody changes or removes a member who ranks above them.
export const assertCanManageTeamMember = (actorRole: TeamRole | undefined, memberRole: TeamRole): void => {
    if (!hasTeamRole(actorRole, memberRole)) {
        throw ApplicationError.forbidden(
            ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS,
            `Changing a member with the ${teamRoleLabel(memberRole)} role needs the ${teamRoleLabel(memberRole)} role or higher`
        );
    }
};

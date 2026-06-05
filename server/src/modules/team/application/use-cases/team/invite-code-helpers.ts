import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { getTeamMemberRolePermissions } from '@modules/team/domain/entities/team-member/TeamMember';
import ApplicationError from '@shared/application/errors/ApplicationError';

const MANAGE_INVITE_CODES_MESSAGE = 'You do not have permission to manage invite codes';

export const normalizeInviteCode = (code: string): string => {
    return code.trim().toUpperCase();
};

export const invalidInviteCodeError = (): ApplicationError => {
    return ApplicationError.notFound(
        ErrorCodes.TEAM_INVITE_CODE_NOT_FOUND,
        'Invalid invite code'
    );
};

export const getInviteCodePermissionError = async (
    teamMemberRepository: ITeamMemberRepository,
    teamId: string,
    userId: string
): Promise<ApplicationError | null> => {
    const member = await teamMemberRepository.findOne(
        { team: teamId, user: userId },
        { populate: ['role'] }
    );

    if (!member) {
        return ApplicationError.forbidden(
            ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS,
            MANAGE_INVITE_CODES_MESSAGE
        );
    }

    const permissions = getTeamMemberRolePermissions(member.props.role);
    const requiredPermission = `${Resource.TEAM_INVITATION}:${Action.CREATE}`;
    const canManage = permissions.includes('*') || permissions.includes(requiredPermission);

    return canManage
        ? null
        : ApplicationError.forbidden(
            ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS,
            MANAGE_INVITE_CODES_MESSAGE
        );
};

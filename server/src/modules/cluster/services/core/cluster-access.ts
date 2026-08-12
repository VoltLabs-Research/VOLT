import { ErrorCodes } from '@core/constants/error-codes';
import User from '@modules/auth/models/User';
import BcryptPasswordHasher from '@modules/auth/services/BcryptPasswordHasher';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationError';

const passwordHasher = new BcryptPasswordHasher();

export const requireOwnedTeamCluster = async (
    teamClusterId: string,
    teamId: string
): Promise<TeamClusterEntity> => {
    const entity = await TeamClusterEntity.findOneBy({ id: teamClusterId });
    if (!entity || entity.team !== teamId) {
        throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 'Team cluster not found');
    }

    return entity;
};

export const requireConfirmedPassword = async (userId: string, password: string): Promise<void> => {
    const user = await User.findOneBy({ id: userId });
    if (!user) {
        throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
    }

    if (!user.password) {
        throw ApplicationError.badRequest(
            ErrorCodes.TEAM_CLUSTER_PASSWORD_CONFIRMATION_UNAVAILABLE,
            'Password confirmation is not available for this account'
        );
    }

    if (!await passwordHasher.compare(password, user.password)) {
        throw ApplicationError.badRequest(
            ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
            'Password confirmation failed'
        );
    }
};

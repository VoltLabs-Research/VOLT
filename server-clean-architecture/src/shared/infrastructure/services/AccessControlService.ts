import { injectable, inject } from 'tsyringe';
import { IAccessControlService, IAccessControlSubject, IPermissionStrategy } from '@/src/shared/domain/ports/IAccessControlService';
import { UserStrategy } from './strategies/UserStrategy';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';

@injectable()
export class AccessControlService implements IAccessControlService {
    private strategies: Record<string, IPermissionStrategy>;

    constructor() {
        this.strategies = {
            'user': new UserStrategy()
        };
    }

    async enforce(subject: IAccessControlSubject, teamId: string, requiredPermission: string): Promise<void> {
        const strategy = this.strategies[subject.type];
        if (!strategy) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_OBJECT_ID,
                'Access control strategy not found'
            );
        }

        const permissions = await strategy.getPermissions(subject, teamId);

        const hasWildcard = permissions.includes('*');
        const hasExactPermission = permissions.includes(requiredPermission);

        if (!hasWildcard && !hasExactPermission) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_INSUFFICIENT_PERMISSIONS,
                `Missing permission: ${requiredPermission}`
            );
        }
    }
}

// Singleton instance for direct import
export const accessControlService = new AccessControlService();

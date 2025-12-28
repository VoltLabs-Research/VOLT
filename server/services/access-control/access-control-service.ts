import { ErrorCodes } from '@/constants/error-codes';
import { IAccessControlSubject, IPermissionStrategy } from '@/services/access-control/interfaces';
import UserStrategy from '@/services/access-control/strategies/user-strategy';
import RuntimeError from '@/utilities/runtime/runtime-error';

class AccessControlService {
    private strategies: Record<string, IPermissionStrategy>;

    constructor() {
        this.strategies = {
            'user': new UserStrategy()
        };
    }

    async enforce(subject: IAccessControlSubject, teamId: string, requiredPermission: string): Promise<void> {
        const strategy = this.strategies[subject.type];
        if (!strategy) {
            throw new RuntimeError(ErrorCodes.ACCESS_CONTROL_STRATEGY_NOT_FOUND, 500);
        }

        const permissions = await strategy.getPermissions(subject, teamId);

        const hasWildcard = permissions.includes('*');
        const hasExactPermission = permissions.includes(requiredPermission);

        if (!hasWildcard && !hasExactPermission) {
            throw new RuntimeError(ErrorCodes.ACCESS_CONTROL_MISSING_PERMISSION, 403);
        }
    }
}

export default new AccessControlService();
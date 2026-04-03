import GetGlobalSearchUseCase from '@modules/dashboard/application/use-cases/GetGlobalSearchUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

const withAuthenticatedUserId = (
    req: AuthenticatedRequest,
    params: Record<string, unknown>
): Record<string, unknown> => ({
    ...params,
    userId: req.userId
});

const GetGlobalSearchController = createController(GetGlobalSearchUseCase, {
    extendParams: withAuthenticatedUserId
});

export default createControllerRegistry({
    getGlobalSearch: GetGlobalSearchController
});

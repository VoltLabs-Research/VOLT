import CloneTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/CloneTrajectoryUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

const withAuthenticatedUserId = (
    req: AuthenticatedRequest,
    params: Record<string, unknown>
): Record<string, unknown> => ({
    ...params,
    userId: req.userId
});

export default createController(CloneTrajectoryUseCase, {
    statusCode: HttpStatus.Accepted,
    extendParams: withAuthenticatedUserId
});

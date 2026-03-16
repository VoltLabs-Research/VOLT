import { GetPublicCanvasBootstrapUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasBootstrapUseCase';
import { AuthenticationType } from '@shared/infrastructure/http/middleware/authentication';
import { createController } from '@shared/infrastructure/http/controllers/createController';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

const withOptionalUserId = (
    req: AuthenticatedRequest,
    params: Record<string, unknown>
): Record<string, unknown> => ({
    ...params,
    userId: req.authType === AuthenticationType.User
        ? req.userId
        : undefined
});

export default createController(GetPublicCanvasBootstrapUseCase, {
    extendParams: withOptionalUserId
});

import GetPublicCanvasBootstrapController from '@modules/trajectory/infrastructure/http/controllers/canvas/GetPublicCanvasBootstrapController';
import { canvasValidation } from '@modules/trajectory/infrastructure/http/validation/canvas';
import { authenticateOptional } from '@shared/infrastructure/http/middleware/authentication';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

const handleBootstrap = (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const controller = container.resolve(GetPublicCanvasBootstrapController);
    return controller.handle(req, res);
};

export default createHttpModule({
    basePath: '/api/canvas',
    middleware: authenticateOptional,
    routes: (router) => {
        router.get('/:trajectoryId/bootstrap', canvasValidation.getBootstrap, handleBootstrap);
    }
});

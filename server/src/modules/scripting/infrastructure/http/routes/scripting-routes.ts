import { Resource } from '@core/constants/resources';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import scriptingControllers from '@modules/scripting/infrastructure/http/controllers';
import type { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/scripting/:teamId',
    router,
    resource: Resource.SCRIPTING
};

const createJupyterSessionRateLimit = createStandardRateLimiter(5);

router.get('/notebooks', scriptingControllers.listNotebooks.handle);
router.get('/:trajectoryId/notebooks', scriptingControllers.listNotebooks.handle);
router.post('/:trajectoryId/sessions', createJupyterSessionRateLimit, scriptingControllers.createJupyterSession.handle);
router.delete('/notebooks/:notebookId', scriptingControllers.deleteNotebook.handle);

export default module;

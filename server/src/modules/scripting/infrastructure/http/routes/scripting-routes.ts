import { Resource } from '@core/constants/resources';
import scriptingControllers from '@modules/scripting/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/scripting/:teamId',
    resource: Resource.SCRIPTING,
    routes: (router) => {
        router.get('/notebooks', scriptingControllers.listNotebooks.handle);
        router.post('/notebooks', scriptingControllers.createNotebook.handle);
        router.patch('/notebooks/:notebookId', scriptingControllers.updateNotebook.handle);
        router.get('/:trajectoryId/notebooks', scriptingControllers.listNotebooks.handle);
        router.post('/sessions', RATE_LIMIT_POLICIES.scriptingSessionCreate, scriptingControllers.createNotebookJupyterSession.handle);
        router.post('/:trajectoryId/sessions', RATE_LIMIT_POLICIES.scriptingSessionCreate, scriptingControllers.createJupyterSession.handle);
        router.delete('/notebooks/:notebookId', scriptingControllers.deleteNotebook.handle);
    }
});

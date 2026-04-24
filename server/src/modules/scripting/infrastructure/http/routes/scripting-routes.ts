import { Resource } from '@core/constants/resources';
import scriptingControllers from '@modules/scripting/infrastructure/http/controllers';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/scripting/:teamId',
    resource: Resource.SCRIPTING,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/notebooks', scriptingControllers.listNotebooks.handle);
        router.post('/notebooks', scriptingControllers.createNotebook.handle);
        router.patch('/notebooks/:notebookId', scriptingControllers.updateNotebook.handle);
        router.get('/:trajectoryId/notebooks', scriptingControllers.listNotebooks.handle);
        router.get('/sessions/:notebookId/status', scriptingControllers.getSessionStatus.handle);
        router.delete('/sessions/:notebookId', scriptingControllers.deleteSession.handle);
        router.post('/sessions', scriptingControllers.createNotebookJupyterSession.handle);
        router.post('/:trajectoryId/sessions', scriptingControllers.createJupyterSession.handle);
        router.delete('/notebooks/:notebookId', scriptingControllers.deleteNotebook.handle);
    }
});

import { Resource } from '@core/constants/resources';
import ScriptingController from '@modules/scripting/controllers/ScriptingController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(ScriptingController);

export default createHttpModule({
    moduleKey: 'scripting',
    basePath: '/api/scripting/:teamId',
    resource: Resource.SCRIPTING,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/notebooks', controller.listNotebooks);
        router.post('/notebooks', controller.createNotebook);
        router.patch('/notebooks/:notebookId', controller.updateNotebook);
        router.get('/:trajectoryId/notebooks', controller.listNotebooks);
        router.get('/sessions/:notebookId/status', controller.getSessionStatus);
        router.delete('/sessions/:notebookId', controller.deleteSession);
        router.post('/sessions', controller.createJupyterSession);
        router.post('/:trajectoryId/sessions', controller.createJupyterSession);
        router.delete('/notebooks/:notebookId', controller.deleteNotebook);
    }
});

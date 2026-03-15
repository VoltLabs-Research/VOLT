import controllers from '@modules/container/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/containers/:teamId',
    resource: Resource.CONTAINER,
    routes: (router) => {
        router.route('/')
            .post(controllers.create.handle)
            .get(controllers.listByTeamId.handle);

        router.get('/folders', controllers.listFolders.handle);
        router.get('/folders/:folderId', controllers.getFolder.handle);
        router.post('/folders', controllers.createFolder.handle);
        router.patch('/folders/:folderId', controllers.updateFolder.handle);
        router.delete('/folders/:folderId', controllers.deleteFolder.handle);

        router.route('/:containerId')
            .get(controllers.getById.handle)
            .patch(controllers.updateById.handle)
            .delete(controllers.deleteById.handle);

        router.patch('/:containerId/folder', controllers.move.handle);

        router.get('/:containerId/files', controllers.getFilesById.handle);
        router.get('/:containerId/processes', controllers.getProcessesById.handle);
        router.get('/:containerId/stats', controllers.getStatsById.handle);
        router.get('/:containerId/files/content', controllers.readFileById.handle);
    }
});

import ContainerController from '@modules/container/controllers/ContainerController';
import type { DeleteContainerFolderInputDTO } from '@modules/container/dtos/DeleteContainerFolderDTO';
import { DeleteContainerFolderUseCase } from '@modules/container/use-cases/DeleteContainerFolderUseCase';
import { ContainerFolderRepository } from '@modules/container/repositories/ContainerFolderRepository';
import { Resource } from '@core/constants/resources';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container as diContainer } from 'tsyringe';

const controller = diContainer.resolve(ContainerController);

const folderHandlers = createCatalogFolderRouteHandlers({
    repository: diContainer.resolve(ContainerFolderRepository),
    folderLabel: 'Container folder',
    deleteFolder: (input: DeleteContainerFolderInputDTO) => diContainer.resolve(DeleteContainerFolderUseCase).execute(input),
    deleteStatusCode: HttpStatus.NoContent,
    buildDeleteInput: (req) => {
        const { teamId, folderId } = req.params as { teamId: string; folderId: string };
        return {
            teamId,
            folderId,
            userId: req.userId as string
        };
    }
});

export default createHttpModule({
    moduleKey: 'container',
    basePath: '/api/containers/:teamId',
    resource: Resource.CONTAINER,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.route('/')
            .post(controller.create)
            .get(controller.listByTeamId);

        router.get('/folders', folderHandlers.list);
        router.get('/folders/:folderId', folderHandlers.get);
        router.post('/folders', folderHandlers.create);
        router.patch('/folders/:folderId', folderHandlers.update);
        router.delete('/folders/:folderId', folderHandlers.delete);

        router.route('/:containerId')
            .get(controller.getById)
            .patch(controller.updateById)
            .delete(controller.deleteById);

        router.post('/:containerId/ports/:privatePort/access-url', controller.createPortAccessUrl);

        router.patch('/:containerId/folder', controller.move);

        router.get('/:containerId/files', controller.getFilesById);
        router.get('/:containerId/processes', controller.getProcessesById);
        router.get('/:containerId/stats', controller.getStatsById);
        router.get('/:containerId/files/content', controller.readFileById);
    }
});

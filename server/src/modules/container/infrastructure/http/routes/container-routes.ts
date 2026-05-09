import controllers from '@modules/container/infrastructure/http/controllers';
import type { DeleteContainerFolderInputDTO } from '@modules/container/application/dtos/DeleteContainerFolderDTO';
import { DeleteContainerFolderUseCase } from '@modules/container/application/use-cases/DeleteContainerFolderUseCase';
import { ContainerFolderRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerFolderRepository';
import { Resource } from '@core/constants/resources';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container as diContainer } from 'tsyringe';

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
    basePath: '/api/containers/:teamId',
    resource: Resource.CONTAINER,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.route('/')
            .post(controllers.create.handle)
            .get(controllers.listByTeamId.handle);

        router.get('/folders', createValidationMiddleware(containerValidation.listFolders), folderHandlers.list);
        router.get('/folders/:folderId', createValidationMiddleware(containerValidation.getFolder), folderHandlers.get);
        router.post('/folders', createValidationMiddleware(containerValidation.createFolder), folderHandlers.create);
        router.patch('/folders/:folderId', createValidationMiddleware(containerValidation.updateFolder), folderHandlers.update);
        router.delete('/folders/:folderId', createValidationMiddleware(containerValidation.deleteFolder), folderHandlers.delete);

        router.route('/:containerId')
            .get(controllers.getById.handle)
            .patch(controllers.updateById.handle)
            .delete(controllers.deleteById.handle);

        router.post('/:containerId/ports/:privatePort/session', controllers.createPortProxySession.handle);

        router.patch('/:containerId/folder', controllers.move.handle);

        router.get('/:containerId/files', controllers.getFilesById.handle);
        router.get('/:containerId/processes', controllers.getProcessesById.handle);
        router.get('/:containerId/stats', controllers.getStatsById.handle);
        router.get('/:containerId/files/content', controllers.readFileById.handle);
    }
});

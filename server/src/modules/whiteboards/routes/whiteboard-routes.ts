import { Resource } from '@core/constants/resources';
import type { DeleteWhiteboardFolderInputDTO } from '@modules/whiteboards/dtos/DeleteWhiteboardFolderDTO';
import { DeleteWhiteboardFolderUseCase } from '@modules/whiteboards/use-cases/DeleteWhiteboardFolderUseCase';
import WhiteboardFolderRepository from '@modules/whiteboards/repositories/WhiteboardFolderRepository';
import WhiteboardController from '@modules/whiteboards/controllers/WhiteboardController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import express from 'express';
import { container } from 'tsyringe';

const controller = container.resolve(WhiteboardController);
const stateBodyParser = express.json({ limit: '10mb' });
const folderHandlers = createCatalogFolderRouteHandlers({
    repository: container.resolve(WhiteboardFolderRepository),
    folderLabel: 'Whiteboard folder',
    deleteFolder: (input: DeleteWhiteboardFolderInputDTO) => container.resolve(DeleteWhiteboardFolderUseCase).execute(input),
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
    basePath: '/api/whiteboards/:teamId',
    resource: Resource.WHITEBOARD,
    teamScope: HttpModuleTeamScope.BasePath,
    moduleKey: 'whiteboards',
    routes: (router) => {
        router.post('/', controller.createWhiteboard);
        router.get('/', controller.listWhiteboards);
        router.get('/folders', folderHandlers.list);
        router.get('/folders/:folderId', folderHandlers.get);
        router.post('/folders', folderHandlers.create);
        router.patch('/folders/:folderId', folderHandlers.update);
        router.delete('/folders/:folderId', folderHandlers.delete);
        router.get('/:whiteboardId', controller.getWhiteboard);
        router.patch('/:whiteboardId', controller.updateWhiteboard);
        router.delete('/:whiteboardId', controller.deleteWhiteboard);
        router.patch('/:whiteboardId/folder', controller.moveWhiteboard);
        router.get('/:whiteboardId/state', controller.getWhiteboardState);
        router.patch('/:whiteboardId/state', stateBodyParser, controller.saveWhiteboardState);
        router.post('/:whiteboardId/assets', controller.uploadWhiteboardAsset);
        router.get('/:whiteboardId/assets/:assetId', controller.getWhiteboardAsset);
    }
});

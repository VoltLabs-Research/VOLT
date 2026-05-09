import { Resource } from '@core/constants/resources';
import type { DeleteWhiteboardFolderInputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardFolderDTO';
import { DeleteWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardFolderUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';
import WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import whiteboardControllers from '@modules/whiteboards/infrastructure/http/controllers';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import express from 'express';
import { container } from 'tsyringe';

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
    routes: (router) => {
        router.post('/', whiteboardControllers.createWhiteboard.handle);
        router.get('/', whiteboardControllers.listWhiteboards.handle);
        router.get('/folders', createValidationMiddleware(whiteboardValidation.listFolders), folderHandlers.list);
        router.get('/folders/:folderId', createValidationMiddleware(whiteboardValidation.getFolder), folderHandlers.get);
        router.post('/folders', createValidationMiddleware(whiteboardValidation.createFolder), folderHandlers.create);
        router.patch('/folders/:folderId', createValidationMiddleware(whiteboardValidation.updateFolder), folderHandlers.update);
        router.delete('/folders/:folderId', createValidationMiddleware(whiteboardValidation.deleteFolder), folderHandlers.delete);
        router.get('/:whiteboardId', whiteboardControllers.getWhiteboard.handle);
        router.patch('/:whiteboardId', whiteboardControllers.updateWhiteboard.handle);
        router.delete('/:whiteboardId', whiteboardControllers.deleteWhiteboard.handle);
        router.patch('/:whiteboardId/folder', whiteboardControllers.moveWhiteboard.handle);
        router.get('/:whiteboardId/state', whiteboardControllers.getWhiteboardState.handle);
        router.patch('/:whiteboardId/state', stateBodyParser, whiteboardControllers.saveWhiteboardState.handle);
        router.post('/:whiteboardId/assets', upload.single('file'), whiteboardControllers.uploadWhiteboardAsset.handle);
        router.get('/:whiteboardId/assets/:assetId', whiteboardControllers.getWhiteboardAsset.handle);
    }
});

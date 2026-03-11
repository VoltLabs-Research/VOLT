import { Resource } from '@core/constants/resources';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import whiteboardControllers from '@modules/whiteboards/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import express from 'express';

const stateBodyParser = express.json({ limit: '10mb' });

export default createHttpModule({
    basePath: '/api/whiteboards/:teamId',
    resource: Resource.WHITEBOARD,
    routes: (router) => {
        router.post('/', whiteboardControllers.createWhiteboard.handle);
        router.get('/', whiteboardControllers.listWhiteboards.handle);
        router.get('/:whiteboardId', whiteboardControllers.getWhiteboard.handle);
        router.patch('/:whiteboardId', whiteboardControllers.updateWhiteboard.handle);
        router.delete('/:whiteboardId', whiteboardControllers.deleteWhiteboard.handle);
        router.get('/:whiteboardId/state', whiteboardControllers.getWhiteboardState.handle);
        router.patch('/:whiteboardId/state', stateBodyParser, whiteboardControllers.saveWhiteboardState.handle);
        router.post('/:whiteboardId/assets', upload.single('file'), whiteboardControllers.uploadWhiteboardAsset.handle);
        router.get('/:whiteboardId/assets/:assetId', whiteboardControllers.getWhiteboardAsset.handle);
    }
});

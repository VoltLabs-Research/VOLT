import CreateWhiteboardController from './CreateWhiteboardController';
import ListWhiteboardsController from './ListWhiteboardsController';
import GetWhiteboardController from './GetWhiteboardController';
import UpdateWhiteboardController from './UpdateWhiteboardController';
import DeleteWhiteboardController from './DeleteWhiteboardController';
import GetWhiteboardStateController from './GetWhiteboardStateController';
import SaveWhiteboardStateController from './SaveWhiteboardStateController';
import UploadWhiteboardAssetController from './UploadWhiteboardAssetController';
import GetWhiteboardAssetController from './GetWhiteboardAssetController';
import { container } from 'tsyringe';

const whiteboardControllers = {
    createWhiteboard: container.resolve(CreateWhiteboardController),
    listWhiteboards: container.resolve(ListWhiteboardsController),
    getWhiteboard: container.resolve(GetWhiteboardController),
    updateWhiteboard: container.resolve(UpdateWhiteboardController),
    deleteWhiteboard: container.resolve(DeleteWhiteboardController),
    getWhiteboardState: container.resolve(GetWhiteboardStateController),
    saveWhiteboardState: container.resolve(SaveWhiteboardStateController),
    uploadWhiteboardAsset: container.resolve(UploadWhiteboardAssetController),
    getWhiteboardAsset: container.resolve(GetWhiteboardAssetController)
};

export default whiteboardControllers;

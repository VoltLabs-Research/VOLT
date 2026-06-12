import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UploadWhiteboardAssetUseCase } from '@modules/whiteboards/application/use-cases/UploadWhiteboardAssetUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UploadWhiteboardAssetUseCase, {
    statusCode: HttpStatus.Created
});

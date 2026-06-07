import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UploadLatexAssetUseCase } from '@modules/latex/application/use-cases/UploadLatexAssetUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UploadLatexAssetUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

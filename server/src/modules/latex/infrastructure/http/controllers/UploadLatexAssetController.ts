import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UploadLatexAssetUseCase } from '@modules/latex/application/use-cases/UploadLatexAssetUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UploadLatexAssetUseCase, {
    validationSchema: latexValidation.uploadAsset,
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

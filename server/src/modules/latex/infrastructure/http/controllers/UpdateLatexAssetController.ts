import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateLatexAssetUseCase } from '@modules/latex/application/use-cases/UpdateLatexAssetUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UpdateLatexAssetUseCase, {
    validationSchema: latexValidation.updateAsset,
    statusCode: HttpStatus.OK
});

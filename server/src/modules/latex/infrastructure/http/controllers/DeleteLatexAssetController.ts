import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteLatexAssetUseCase } from '@modules/latex/application/use-cases/DeleteLatexAssetUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteLatexAssetUseCase, {
    validationSchema: latexValidation.deleteAsset,
    statusCode: HttpStatus.NoContent
});

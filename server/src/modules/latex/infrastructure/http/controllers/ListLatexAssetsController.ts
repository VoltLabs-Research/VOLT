import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ListLatexAssetsUseCase } from '@modules/latex/application/use-cases/ListLatexAssetsUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(ListLatexAssetsUseCase, {
    validationSchema: latexValidation.listAssets,
    statusCode: HttpStatus.OK
});

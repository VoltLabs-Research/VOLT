import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ListLatexFilesUseCase } from '@modules/latex/application/use-cases/ListLatexFilesUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(ListLatexFilesUseCase, {
    validationSchema: latexValidation.listFiles,
    statusCode: HttpStatus.OK
});

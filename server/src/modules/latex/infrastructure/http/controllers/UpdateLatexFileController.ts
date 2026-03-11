import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateLatexFileUseCase } from '@modules/latex/application/use-cases/UpdateLatexFileUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UpdateLatexFileUseCase, {
    validationSchema: latexValidation.updateFile,
    statusCode: HttpStatus.OK
});

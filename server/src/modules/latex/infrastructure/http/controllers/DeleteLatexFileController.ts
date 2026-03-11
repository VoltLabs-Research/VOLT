import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteLatexFileUseCase } from '@modules/latex/application/use-cases/DeleteLatexFileUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteLatexFileUseCase, {
    validationSchema: latexValidation.deleteFile,
    statusCode: HttpStatus.OK
});

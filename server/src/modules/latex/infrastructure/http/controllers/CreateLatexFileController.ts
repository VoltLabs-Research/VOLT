import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateLatexFileUseCase } from '@modules/latex/application/use-cases/CreateLatexFileUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateLatexFileUseCase, {
    validationSchema: latexValidation.createFile,
    statusCode: HttpStatus.Created
});

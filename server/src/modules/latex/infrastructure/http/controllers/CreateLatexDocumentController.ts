import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateLatexDocumentUseCase } from '@modules/latex/application/use-cases/CreateLatexDocumentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateLatexDocumentUseCase, {
    validationSchema: latexValidation.createDocument,
    statusCode: HttpStatus.Created
});

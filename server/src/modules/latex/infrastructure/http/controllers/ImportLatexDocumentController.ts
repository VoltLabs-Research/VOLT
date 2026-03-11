import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ImportLatexDocumentUseCase } from '@modules/latex/application/use-cases/ImportLatexDocumentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(ImportLatexDocumentUseCase, {
    validationSchema: latexValidation.importDocument,
    statusCode: HttpStatus.Created
});

import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetLatexDocumentUseCase } from '@modules/latex/application/use-cases/GetLatexDocumentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(GetLatexDocumentUseCase, {
    validationSchema: latexValidation.getDocument,
    statusCode: HttpStatus.OK
});

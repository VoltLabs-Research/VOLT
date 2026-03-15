import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteLatexDocumentUseCase, {
    validationSchema: latexValidation.deleteDocument,
    statusCode: HttpStatus.NoContent,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

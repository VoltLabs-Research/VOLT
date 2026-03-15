import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateLatexDocumentUseCase } from '@modules/latex/application/use-cases/UpdateLatexDocumentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UpdateLatexDocumentUseCase, {
    validationSchema: latexValidation.updateDocument,
    statusCode: HttpStatus.OK,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

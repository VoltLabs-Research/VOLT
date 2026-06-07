import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ImportLatexDocumentUseCase } from '@modules/latex/application/use-cases/ImportLatexDocumentUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(ImportLatexDocumentUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

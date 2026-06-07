import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateLatexDocumentUseCase } from '@modules/latex/application/use-cases/CreateLatexDocumentUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateLatexDocumentUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

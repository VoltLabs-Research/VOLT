import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateLatexDocumentUseCase } from '@modules/latex/application/use-cases/UpdateLatexDocumentUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UpdateLatexDocumentUseCase, {
    statusCode: HttpStatus.OK,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

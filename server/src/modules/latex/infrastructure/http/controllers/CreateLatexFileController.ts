import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateLatexFileUseCase } from '@modules/latex/application/use-cases/CreateLatexFileUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateLatexFileUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

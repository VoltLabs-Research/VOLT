import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetLatexDocumentUseCase } from '@modules/latex/application/use-cases/GetLatexDocumentUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(GetLatexDocumentUseCase, {
    statusCode: HttpStatus.OK
});

import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteLatexDocumentUseCase, {
    statusCode: HttpStatus.NoContent
});

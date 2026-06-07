import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteLatexFileUseCase } from '@modules/latex/application/use-cases/DeleteLatexFileUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteLatexFileUseCase, {
    statusCode: HttpStatus.OK
});

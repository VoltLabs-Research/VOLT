import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateLatexFileUseCase } from '@modules/latex/application/use-cases/UpdateLatexFileUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UpdateLatexFileUseCase, {
    statusCode: HttpStatus.OK
});

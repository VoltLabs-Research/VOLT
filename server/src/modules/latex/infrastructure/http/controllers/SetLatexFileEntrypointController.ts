import { createController } from '@shared/infrastructure/http/controllers/createController';
import { SetLatexFileEntrypointUseCase } from '@modules/latex/application/use-cases/SetLatexFileEntrypointUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(SetLatexFileEntrypointUseCase, {
    statusCode: HttpStatus.OK
});

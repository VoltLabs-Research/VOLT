import { createController } from '@shared/infrastructure/http/controllers/createController';
import { SetLatexFileEntrypointUseCase } from '@modules/latex/application/use-cases/SetLatexFileEntrypointUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(SetLatexFileEntrypointUseCase, {
    validationSchema: latexValidation.setFileEntrypoint,
    statusCode: HttpStatus.OK
});

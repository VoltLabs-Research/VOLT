import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateLatexFolderUseCase } from '@modules/latex/application/use-cases/CreateLatexFolderUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateLatexFolderUseCase, {
    validationSchema: latexValidation.createFolder,
    statusCode: HttpStatus.Created
});

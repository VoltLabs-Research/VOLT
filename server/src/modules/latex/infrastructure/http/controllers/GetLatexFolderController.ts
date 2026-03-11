import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetLatexFolderUseCase } from '@modules/latex/application/use-cases/GetLatexFolderUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createController(GetLatexFolderUseCase, {
    validationSchema: latexValidation.getFolder
});

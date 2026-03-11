import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteLatexFolderUseCase } from '@modules/latex/application/use-cases/DeleteLatexFolderUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createController(DeleteLatexFolderUseCase, {
    validationSchema: latexValidation.deleteFolder
});

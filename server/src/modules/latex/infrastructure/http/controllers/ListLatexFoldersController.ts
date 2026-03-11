import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListLatexFoldersUseCase } from '@modules/latex/application/use-cases/ListLatexFoldersUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createPaginatedController(ListLatexFoldersUseCase, {
    validationSchema: latexValidation.listFolders
});

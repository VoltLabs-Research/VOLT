import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListLatexDocumentsUseCase } from '@modules/latex/application/use-cases/ListLatexDocumentsUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createPaginatedController(ListLatexDocumentsUseCase, {
    validationSchema: latexValidation.listDocuments
});

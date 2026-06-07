import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListLatexDocumentsUseCase } from '@modules/latex/application/use-cases/ListLatexDocumentsUseCase';

export default createPaginatedController(ListLatexDocumentsUseCase, {
});

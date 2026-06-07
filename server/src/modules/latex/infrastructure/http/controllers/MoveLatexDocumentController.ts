import { createController } from '@shared/infrastructure/http/controllers/createController';
import { MoveLatexDocumentUseCase } from '@modules/latex/application/use-cases/MoveLatexDocumentUseCase';

export default createController(MoveLatexDocumentUseCase, {
});

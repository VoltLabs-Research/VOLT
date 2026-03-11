import { createController } from '@shared/infrastructure/http/controllers/createController';
import { MoveLatexDocumentUseCase } from '@modules/latex/application/use-cases/MoveLatexDocumentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createController(MoveLatexDocumentUseCase, {
    validationSchema: latexValidation.moveDocument
});

import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { CompileLatexDocumentUseCase } from '@modules/latex/application/use-cases/CompileLatexDocumentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createPreparedDownloadStreamController(CompileLatexDocumentUseCase, {
    validationSchema: latexValidation.compileDocument
});

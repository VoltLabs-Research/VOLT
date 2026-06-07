import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { CompileLatexDocumentUseCase } from '@modules/latex/application/use-cases/CompileLatexDocumentUseCase';

export default createPreparedDownloadStreamController(CompileLatexDocumentUseCase, {
});

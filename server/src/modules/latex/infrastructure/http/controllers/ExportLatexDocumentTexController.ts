import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { ExportLatexDocumentTexUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentTexUseCase';

export default createPreparedDownloadStreamController(ExportLatexDocumentTexUseCase, {
});

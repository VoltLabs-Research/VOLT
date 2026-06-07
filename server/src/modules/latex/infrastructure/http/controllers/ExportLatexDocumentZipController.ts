import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { ExportLatexDocumentZipUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentZipUseCase';

export default createPreparedDownloadStreamController(ExportLatexDocumentZipUseCase, {
});

import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { ExportLatexDocumentZipUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentZipUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createPreparedDownloadStreamController(ExportLatexDocumentZipUseCase, {
    validationSchema: latexValidation.exportDocument
});

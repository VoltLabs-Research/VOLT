import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { ExportLatexDocumentTexUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentTexUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createPreparedDownloadStreamController(ExportLatexDocumentTexUseCase, {
    validationSchema: latexValidation.exportDocument
});

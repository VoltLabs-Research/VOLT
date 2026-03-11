import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { ExportLatexDocumentZipUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentZipUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createStreamController(ExportLatexDocumentZipUseCase, {
    validationSchema: latexValidation.exportDocument,
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});

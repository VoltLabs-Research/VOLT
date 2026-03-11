import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { CompileLatexDocumentUseCase } from '@modules/latex/application/use-cases/CompileLatexDocumentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';

export default createStreamController(CompileLatexDocumentUseCase, {
    validationSchema: latexValidation.compileDocument,
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});

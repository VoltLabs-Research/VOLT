import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetLatexAssetContentUseCase } from '@modules/latex/application/use-cases/GetLatexAssetContentUseCase';
import { latexValidation } from '@modules/latex/infrastructure/http/validation/latex-schemas';
import type { GetLatexAssetContentOutputDTO } from '@modules/latex/application/dtos/GetLatexAssetContentDTO';

export default createStreamController(GetLatexAssetContentUseCase, {
    validationSchema: latexValidation.getAssetContent,
    getHeaders: (result: GetLatexAssetContentOutputDTO) => {
        const headers: Record<string, string> = {
            'Content-Type': result.contentType || 'application/octet-stream',
            'Cache-Control': 'private, max-age=300'
        };

        if (typeof result.contentLength === 'number') {
            headers['Content-Length'] = String(result.contentLength);
        }

        if (result.contentEncoding) {
            headers['Content-Encoding'] = result.contentEncoding;
        }

        return headers;
    }
});

import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import GetTrajectoryGLBUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryGLBUseCase';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

const readAcceptEncoding = (req: AuthenticatedRequest): string | undefined => {
    const header = req.headers['accept-encoding'];
    if (Array.isArray(header)) {
        return header.join(',');
    }

    return header;
};

export default createStreamController(GetTrajectoryGLBUseCase, {
    extendParams: (req, params) => ({
        ...params,
        acceptEncoding: readAcceptEncoding(req)
    }),
    getHeaders: (resultValue) => {
        const headers: Record<string, string> = {
            'Content-Type': 'model/gltf-binary',
            'Content-Disposition': `attachment; filename="${resultValue.objectName}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Vary': 'Accept-Encoding'
        };

        if (resultValue.contentEncoding && resultValue.contentEncoding !== 'identity') {
            headers['Content-Encoding'] = resultValue.contentEncoding;
        }

        if (resultValue.contentEncoding === 'zstd' && typeof resultValue.size === 'number' && resultValue.size > 0) {
            headers['Content-Length'] = String(resultValue.size);
        }

        return headers;
    }
});

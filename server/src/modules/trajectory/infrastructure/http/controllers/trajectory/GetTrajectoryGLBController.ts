import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import GetTrajectoryGLBUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryGLBUseCase';

export default createStreamController(GetTrajectoryGLBUseCase, {
    getHeaders: (resultValue) => {
        const headers: Record<string, string> = {
            'Content-Type': 'model/gltf-binary',
            'Content-Disposition': `attachment; filename="${resultValue.objectName}"`,
            'Cache-Control': 'public, max-age=31536000, immutable'
        };

        if (typeof resultValue.size === 'number' && resultValue.size > 0) {
            headers['Content-Length'] = String(resultValue.size);
        }

        return headers;
    }
});

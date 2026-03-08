import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import GetTrajectoryGLBUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryGLBUseCase';

export default createStreamController(GetTrajectoryGLBUseCase, {
    getHeaders: (resultValue) => ({
        'Content-Type': 'model/gltf-binary',
        'Content-Length': String(resultValue.size),
        'Content-Disposition': `attachment; filename="${resultValue.objectName}"`,
        'Cache-Control': 'public, max-age=31536000, immutable'
    })
});

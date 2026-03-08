import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import DownloadTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/DownloadTrajectoryUseCase';

export default createStreamController(DownloadTrajectoryUseCase, {
    getHeaders: (resultValue) => ({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${resultValue.filename}"`,
        'Cache-Control': 'no-cache'
    })
});

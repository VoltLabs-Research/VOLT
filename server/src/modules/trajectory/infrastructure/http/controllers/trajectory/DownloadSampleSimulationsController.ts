import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import DownloadSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/DownloadSampleSimulationsUseCase';

export default createStreamController(DownloadSampleSimulationsUseCase, {
    getHeaders: (resultValue) => ({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${resultValue.filename}"`
    })
});

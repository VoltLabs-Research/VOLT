import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import DownloadTrajectoryAnalysesUseCase from '@modules/trajectory/application/use-cases/trajectory/DownloadTrajectoryAnalysesUseCase';

export default createPreparedDownloadStreamController(DownloadTrajectoryAnalysesUseCase);

import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import DownloadTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/DownloadTrajectoryUseCase';

export default createPreparedDownloadStreamController(DownloadTrajectoryUseCase);

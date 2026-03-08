import { createController } from '@shared/infrastructure/http/controllers/createController';
import ImportTrajectoryFromSSHUseCase from '@modules/ssh/application/use-cases/ImportTrajectoryFromSSHUseCase';

const ImportTrajectoryFromSSHController = createController(ImportTrajectoryFromSSHUseCase);

export default ImportTrajectoryFromSSHController;

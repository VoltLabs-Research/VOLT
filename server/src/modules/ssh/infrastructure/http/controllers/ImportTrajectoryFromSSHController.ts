import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import ImportTrajectoryFromSSHUseCase from '@modules/ssh/application/use-cases/ImportTrajectoryFromSSHUseCase';

const ImportTrajectoryFromSSHController = createController(ImportTrajectoryFromSSHUseCase, HttpStatus.Created);

export default ImportTrajectoryFromSSHController;

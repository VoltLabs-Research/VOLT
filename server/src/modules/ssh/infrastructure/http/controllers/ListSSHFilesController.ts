import { createController } from '@shared/infrastructure/http/controllers/createController';
import ListSSHFilesUseCase from '@modules/ssh/application/use-cases/ListSSHFilesUseCase';

const ListSSHFilesController = createController(ListSSHFilesUseCase);
export default ListSSHFilesController;

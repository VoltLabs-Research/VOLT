import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import GetMyNotificationsUseCase from '@modules/notification/application/use-cases/GetMyNotificationsUseCase';

export default createPaginatedController(GetMyNotificationsUseCase);

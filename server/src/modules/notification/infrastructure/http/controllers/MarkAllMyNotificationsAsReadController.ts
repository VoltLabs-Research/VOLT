import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { MarkAllMyNotificationsAsReadUseCase } from '@modules/notification/application/use-cases';

export default createController(MarkAllMyNotificationsAsReadUseCase, HttpStatus.NoContent);

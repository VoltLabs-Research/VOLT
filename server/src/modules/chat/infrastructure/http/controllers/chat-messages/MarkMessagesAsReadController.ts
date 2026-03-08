import { createController } from '@shared/infrastructure/http/controllers/createController';
import { MarkMessageAsReadUseCase } from '@modules/chat/application/use-cases/chat-message/MarkMessageAsReadUseCase';

const MarkMessagesAsReadController = createController(MarkMessageAsReadUseCase);
export default MarkMessagesAsReadController;

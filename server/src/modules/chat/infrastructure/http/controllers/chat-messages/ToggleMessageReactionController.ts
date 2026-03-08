import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ToggleMessageReactionUseCase } from '@modules/chat/application/use-cases/chat-message/ToggleMessageReactionUseCase';

const ToggleMessageReactionController = createController(ToggleMessageReactionUseCase);
export default ToggleMessageReactionController;

import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';

export default createController(AI_TOKENS.CreateAIConversationUseCase, HttpStatus.Created);

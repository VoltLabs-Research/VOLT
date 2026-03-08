import { Router } from 'express';
import { createBurstRateLimiter, createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/ai/infrastructure/http/controllers';
import { aiConversationValidation } from '@modules/ai/infrastructure/http/validation/ai-schemas';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/ai/conversations',
    router,
    resource: Resource.AI_CONVERSATION,
    teamScope: 'param'
};

const createConversationLimiter = createStandardRateLimiter(20);

const aiMessageLimiter = createBurstRateLimiter(10, 60 * 1000);

router.use(protect);

router.get('/:teamId', controllers.listConversations.handle);
router.post('/:teamId', createConversationLimiter, aiConversationValidation.createConversation, controllers.createConversation.handle);
router.post('/:teamId/start', createConversationLimiter, aiConversationValidation.createConversation, controllers.createConversationWithMessage.handle);

router.get('/:teamId/:conversationId/messages', controllers.listMessages.handle);
router.post('/:teamId/:conversationId/messages', aiMessageLimiter, aiConversationValidation.sendMessage, controllers.sendMessage.handle);

router.post('/:teamId/:conversationId/messages/stream', aiMessageLimiter, aiConversationValidation.sendStreamMessage, controllers.streamMessage.handle);

router.route('/:teamId/:conversationId')
    .patch(aiConversationValidation.updateConversation, controllers.updateConversation.handle)
    .delete(controllers.deleteConversation.handle);

export default module;

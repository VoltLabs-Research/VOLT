import { Router } from 'express';
import { Resource } from '@core/constants/resources';
import { aiConversationValidation } from '@modules/ai/infrastructure/http/validation/ai-schemas';
import controllers from '@modules/ai/infrastructure/http/controllers';
import { createBurstRateLimiter, createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule, HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/ai/conversations',
    router,
    resource: Resource.AI_CONVERSATION,
    teamScope: HttpModuleTeamScope.Param
};

const createConversationLimiter = createStandardRateLimiter(20);

const aiMessageLimiter = createBurstRateLimiter(10, 60 * 1000);

router.use(protect);

router.get('/:teamId', controllers.listConversations.handle);
router.post('/:teamId', createConversationLimiter, aiConversationValidation.createConversation, controllers.createConversation.handle);

router.get('/:teamId/:conversationId/messages', controllers.listMessages.handle);
router.post('/:teamId/:conversationId/messages', aiMessageLimiter, aiConversationValidation.sendMessage, controllers.sendMessage.handle);

router.post('/:teamId/:conversationId/messages/stream', aiMessageLimiter, aiConversationValidation.sendStreamMessage, controllers.streamMessage.handle);

router.route('/:teamId/:conversationId')
    .patch(aiConversationValidation.updateConversation, controllers.updateConversation.handle)
    .delete(controllers.deleteConversation.handle);

export default module;

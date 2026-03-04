import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/ai/infrastructure/http/controllers';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/ai/conversations',
    router,
    resource: Resource.AI_CONVERSATION
};

router.use(protect);

router.route('/:teamId')
    .get(controllers.listConversations.handle)
    .post(controllers.createConversation.handle);

router.route('/:teamId/:conversationId/messages')
    .get(controllers.listMessages.handle)
    .post(controllers.sendMessage.handle);

router.route('/:teamId/:conversationId/messages/stream')
    .post(controllers.streamMessage.handle);

router.route('/:teamId/:conversationId')
    .patch(controllers.updateConversation.handle)
    .delete(controllers.deleteConversation.handle);

export default module;

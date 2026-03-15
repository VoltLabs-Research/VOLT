import { Resource } from '@core/constants/resources';
import { aiConversationValidation } from '@modules/ai/infrastructure/http/validation/ai-schemas';
import controllers from '@modules/ai/infrastructure/http/controllers';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import express from 'express';

export default createHttpModule({
    basePath: '/api/ai/conversations',
    resource: Resource.AI_CONVERSATION,
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.get('/:teamId', controllers.listConversations.handle);
        router.post(
            '/:teamId',
            aiConversationValidation.createConversation,
            controllers.createConversation.handle
        );
        router.get('/:teamId/:conversationId/messages', controllers.listMessages.handle);
        router.post(
            '/:teamId/:conversationId/messages',
            aiConversationValidation.sendMessage,
            controllers.sendMessage.handle
        );
        router.post(
            '/:teamId/:conversationId/messages/stream',
            express.json({ limit: '5mb' }),
            aiConversationValidation.sendStreamMessage,
            controllers.streamMessage.handle
        );
        router.route('/:teamId/:conversationId')
            .patch(aiConversationValidation.updateConversation, controllers.updateConversation.handle)
            .delete(controllers.deleteConversation.handle);
    }
});

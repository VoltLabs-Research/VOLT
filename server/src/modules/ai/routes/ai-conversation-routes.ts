import { Resource } from '@core/constants/resources';
import AiController from '@modules/ai/controllers/AiController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';
import express from 'express';

const controller = container.resolve(AiController);

export default createHttpModule({
    moduleKey: 'ai',
    basePath: '/api/ai/conversations',
    resource: Resource.AI_CONVERSATION,
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.get('/:teamId', controller.listConversations);
        router.post(
            '/:teamId',
            controller.createConversation
        );
        router.get('/:teamId/:conversationId/messages', controller.listMessages);
        router.post(
            '/:teamId/:conversationId/messages/stream',
            express.json({ limit: '5mb' }),
            controller.streamMessage
        );
        router.route('/:teamId/:conversationId')
            .patch(controller.updateConversation)
            .delete(controller.deleteConversation);
    }
});

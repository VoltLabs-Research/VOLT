import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import AiService from '@modules/ai/services/AiService';
import { aiRoutes } from '@volt/contracts/modules/ai/routes';
import type {
    CreateAIConversationInput,
    UpdateAIConversationInput,
    SendAIConversationMessageInput
} from '@volt/contracts/modules/ai/http';
import type { AIConversationMessage } from '@modules/ai/contracts/ai-message';
import type { AIProvider } from '@shared/contracts/types/AIProviders';
import express from 'express';
import type { Response } from 'express';

const streamBodyParser = express.json({ limit: '5mb' });

@Middleware(protect, teamScoped(Resource.AI_CONVERSATION))
export default class AiController extends Controller {
    #service = new AiService();

    @Route(aiRoutes.listConversations)
    listConversations(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Query() query: Record<string, string>
    ) {
        return this.#service.listConversations({
            teamId,
            userId,
            page: Number(query.page),
            limit: Number(query.limit),
            includeArchived: query.includeArchived
        });
    }

    @Route(aiRoutes.createConversation)
    @Status(201)
    createConversation(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateAIConversationInput
    ) {
        return this.#service.createConversation({
            teamId,
            userId,
            ...body
        });
    }

    @Route(aiRoutes.listMessages)
    listMessages(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string,
        @Query() query: Record<string, string>
    ) {
        return this.#service.listMessages({
            teamId,
            userId,
            conversationId,
            page: Number(query.page),
            limit: Number(query.limit)
        });
    }

    @Route(aiRoutes.streamMessage)
    @Middleware(streamBodyParser)
    async streamMessage(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string,
        @Body() body: SendAIConversationMessageInput,
        @Res() res: Response
    ): Promise<void> {
        const value = await this.#service.streamMessage({
            teamId,
            conversationId,
            userId,
            message: body.message,
            messages: body.messages as AIConversationMessage[],
            title: body.title,
            provider: body.provider as AIProvider | undefined,
            model: body.model
        });
        value.streamResult.pipeUIMessageStreamToResponse(res);
    }

    @Route(aiRoutes.updateConversation)
    updateConversation(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string,
        @Body() body: UpdateAIConversationInput
    ) {
        return this.#service.updateConversation({
            teamId,
            userId,
            conversationId,
            ...body
        });
    }

    @Route(aiRoutes.deleteConversation)
    async deleteConversation(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string
    ) {
        await this.#service.deleteConversation({
            teamId,
            userId,
            conversationId
        });
    }
}

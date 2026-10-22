import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, schemaBody, Param, Query, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/errors/ApplicationError';
import conversationService from '@modules/ai/services/ConversationService';
import modelResolver from '@modules/ai/services/ModelResolver';
import chatCompactionService from '@modules/ai/services/chat/ChatCompactionService';
import chatStreamService from '@modules/ai/services/chat/ChatStreamService';
import { aiRoutes } from '@volt/contracts/modules/ai/routes';
import type { CreateAIConversationInput, UpdateAIConversationInput } from '@volt/contracts/modules/ai/http';

@Middleware(protect, teamScoped(Resource.AI_CONVERSATION))
export default class AiController extends Controller {
    @Route(aiRoutes.listConversations)
    listConversations(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Query() query: Record<string, string>
    ) {
        return conversationService.list({
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
        @Body(schemaBody(typia.createValidate<CreateAIConversationInput>())) body: CreateAIConversationInput
    ) {
        return conversationService.create({
            teamId,
            userId
        }, body);
    }

    @Route(aiRoutes.getConversation)
    getConversation(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string
    ) {
        return conversationService.owned({
            teamId,
            userId,
            conversationId
        });
    }

    @Route(aiRoutes.updateConversation)
    updateConversation(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<UpdateAIConversationInput>())) body: UpdateAIConversationInput
    ) {
        return conversationService.update({
            teamId,
            userId,
            conversationId
        }, body);
    }

    @Route(aiRoutes.deleteConversation)
    async deleteConversation(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string
    ) {
        const conversation = await conversationService.owned({
            teamId,
            userId,
            conversationId
        });
        chatStreamService.stop(conversation.id);
        await conversationService.delete({
            teamId,
            userId,
            conversationId
        });
    }

    @Route(aiRoutes.listMessages)
    listMessages(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string,
        @Query() query: Record<string, string>
    ) {
        return conversationService.messages({
            teamId,
            userId,
            conversationId,
            page: Number(query.page),
            limit: Number(query.limit)
        });
    }

    @Route(aiRoutes.compactConversation)
    async compactConversation(
        @Param('teamId') teamId: string,
        @Param('conversationId') conversationId: string,
        @CurrentUser() userId: string
    ) {
        const conversation = await conversationService.owned({
            teamId,
            userId,
            conversationId
        });
        if (chatStreamService.isLive(conversation.id)) {
            throw ApplicationError.conflict(ErrorCodes.AI_TURN_IN_PROGRESS, 'Volt AI is still answering in this conversation');
        }

        const resolved = await modelResolver.resolve(conversation.teamId, conversation.provider ?? undefined, conversation.model ?? undefined);

        return chatCompactionService.compactNow(conversation, resolved.model);
    }
}

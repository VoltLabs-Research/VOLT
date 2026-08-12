import type { FindOptionsWhere } from 'typeorm';
import { ErrorCodes } from '@core/constants/error-codes';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';
import { AIConversationMessageRole } from '@modules/ai/contracts/ai-message';
import type { AIConversationMessage, AIMessagePart } from '@modules/ai/contracts/ai-message';
import type { AIChatReplyStream } from '@modules/ai/services/AISDKChatTransport';
import aiSdkChatTransport from '@modules/ai/services/AISDKChatTransport';
import { persistAssistantResponse } from '@modules/ai/services/AIAssistantResponseStore';
import { toAIMessageView } from '@modules/ai/services/AIMessageViewMapper';
import { assertTeamMembership } from '@modules/team/services/team/team-membership-guard';
import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import logger from '@shared/infrastructure/logger';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';

type AITextPart = AIMessagePart & { text: string };

type AIMessageView = Record<string, unknown>;

const CONVERSATION_PAGE_OPTIONS = {
    defaultLimit: 50,
    maxLimit: 200
};

const isTextPart = (part: AIMessagePart): part is AITextPart => (
    part.type === 'text' && typeof part.text === 'string'
);

const extractLastUserMessageText = (messages: AIConversationMessage[]): string => {
    for(let index = messages.length - 1; index >= 0; index--){
        const message = messages[index];
        if(message.role !== AIConversationMessageRole.User) continue;

        return message.parts
            .filter(isTextPart)
            .map((part) => part.text)
            .join('\n')
            .trim();
    }

    return '';
};

interface AIConversationScope {
    teamId: string;
    userId: string;
}

interface AIConversationRef extends AIConversationScope {
    conversationId: string;
}

interface ListAIConversationsInput extends AIConversationScope {
    page?: number;
    limit?: number;
    includeArchived?: string;
}

interface CreateAIConversationInput extends AIConversationScope {
    title?: string;
    message?: string;
}

interface ListAIConversationMessagesInput extends AIConversationRef {
    page?: number;
    limit?: number;
}

interface SendAIConversationMessageInput extends AIConversationRef {
    message?: string;
    messages: AIConversationMessage[];
    title?: string;
    provider?: AIProvider;
    model?: string;
}

interface UpdateAIConversationInput extends AIConversationRef {
    title?: string;
    isArchived?: boolean;
}

export default class AiService{
    async listConversations(input: ListAIConversationsInput): Promise<PaginatedResult<AIConversation>>{
        const pageRequest = readPageRequest(input.page, input.limit, CONVERSATION_PAGE_OPTIONS);

        const where: FindOptionsWhere<AIConversation> = {
            teamId: input.teamId,
            userId: input.userId
        };

        if(input.includeArchived !== 'true'){
            where.isArchived = false;
        }

        return paginate(await AIConversation.findAndCount({
            where,
            order: {
                lastMessageAt: 'DESC',
                updatedAt: 'DESC'
            },
            take: pageRequest.limit,
            skip: skipFor(pageRequest)
        }), pageRequest);
    }

    async createConversation(input: CreateAIConversationInput): Promise<{
        conversation: AIConversation;
        userMessage?: AIMessageView;
    }>{
        const firstMessage = input.message?.trim();
        const conversation = await AIConversation.create({
            teamId: input.teamId,
            userId: input.userId,
            title: input.title?.trim() || 'New Conversation',
            isArchived: false,
            lastMessageAt: firstMessage ? new Date() : null
        }).save();

        if(!firstMessage) return { conversation };

        const userMessage = await AIMessage.create({
            conversationId: conversation.id,
            role: AIMessageRole.User,
            parts: [
                {
                    type: 'text',
                    text: firstMessage
                }
            ],
            content: firstMessage,
            modelInfo: null,
            tokenUsage: null
        }).save();

        return {
            conversation,
            userMessage: toAIMessageView(userMessage)
        };
    }

    async listMessages(input: ListAIConversationMessagesInput): Promise<PaginatedResult<AIMessageView>>{
        const pageRequest = readPageRequest(input.page, input.limit, CONVERSATION_PAGE_OPTIONS);
        const conversation = await this.#requireOwnedConversation(input);

        const [messages, total] = await AIMessage.findAndCount({
            where: { conversationId: conversation.id },
            order: { createdAt: 'ASC' },
            take: pageRequest.limit,
            skip: skipFor(pageRequest)
        });

        return paginate([messages.map(toAIMessageView), total], pageRequest);
    }

    async streamMessage(input: SendAIConversationMessageInput): Promise<{
        streamResult: AIChatReplyStream;
        userMessage?: AIMessageView;
        assistantMessage: Promise<AIMessageView | undefined>;
    }>{
        await assertTeamMembership(input.teamId, input.userId);

        const conversation = await this.#requireOwnedConversation(input);
        const conversationId = conversation.id;
        const isContinuation = input.messages[input.messages.length - 1]?.role === AIConversationMessageRole.Assistant;

        let userMessage: AIMessage | null = null;
        let existingAssistantMessage: AIMessage | null = null;

        if(isContinuation){
            existingAssistantMessage = await AIMessage.findOne({
                where: {
                    conversationId,
                    role: AIMessageRole.Assistant
                },
                order: { createdAt: 'DESC' }
            });
            logger.debug(
                'AI conversation %s: continuation detected, existing assistant message %s',
                conversationId,
                existingAssistantMessage?.id ?? 'not found'
            );
        }else{
            const userText = input.message?.trim() || extractLastUserMessageText(input.messages);

            if(userText){
                userMessage = await AIMessage.create({
                    conversationId,
                    role: AIMessageRole.User,
                    parts: [
                        {
                            type: 'text',
                            text: userText
                        }
                    ],
                    content: userText,
                    modelInfo: null,
                    tokenUsage: null
                }).save();
            }
        }

        let resolveAssistantMessage!: (message: AIMessageView | undefined) => void;
        let rejectAssistantMessage!: (error: unknown) => void;
        const assistantMessage = new Promise<AIMessageView | undefined>((resolve, reject) => {
            resolveAssistantMessage = resolve;
            rejectAssistantMessage = reject;
        });

        try{
            const streamResult = await aiSdkChatTransport.generateReplyStream({
                teamId: input.teamId,
                userId: input.userId,
                provider: input.provider,
                model: input.model,
                messages: input.messages,
                onFinish: async (event) => {
                    try{
                        const persisted = await persistAssistantResponse(
                            conversationId,
                            event,
                            existingAssistantMessage
                        );

                        await AIConversation.update({ id: conversationId }, {
                            lastMessageAt: new Date(),
                            lastProvider: event.provider,
                            lastModel: event.model,
                            title: input.title?.trim() || conversation.title
                        });
                        resolveAssistantMessage(persisted);
                    }catch(error){
                        rejectAssistantMessage(error);
                        throw error;
                    }
                }
            });

            return {
                streamResult,
                userMessage: userMessage ? toAIMessageView(userMessage) : undefined,
                assistantMessage
            };
        }catch(error){
            rejectAssistantMessage(error);
            throw error;
        }
    }

    async updateConversation(input: UpdateAIConversationInput): Promise<AIConversation>{
        const conversation = await this.#requireOwnedConversation(input);

        if(input.title !== undefined) conversation.title = input.title.trim();
        if(input.isArchived !== undefined) conversation.isArchived = input.isArchived;

        return conversation.save();
    }

    async deleteConversation(input: AIConversationRef): Promise<void>{
        const conversation = await this.#requireOwnedConversation(input);

        await AIMessage.delete({ conversationId: conversation.id });
        await AIConversation.delete({ id: conversation.id });
    }

    async #requireOwnedConversation({ conversationId, teamId, userId }: AIConversationRef): Promise<AIConversation>{
        const conversation = await AIConversation.findOneBy({
            id: conversationId,
            teamId,
            userId
        });

        if(!conversation){
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        return conversation;
    }
}

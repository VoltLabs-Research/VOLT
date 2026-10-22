import type { FindOptionsWhere } from 'typeorm';
import AIConversation from '@modules/ai/models/AIConversation';
import chatMessageService from '@modules/ai/services/chat/ChatMessageService';
import { wireMessageOf } from '@modules/ai/services/chat/message-parts';
import type { AIConversationMessage } from '@volt/contracts/modules/ai/chat';
import type { AIModelChoice } from '@volt/contracts/modules/ai/domain';
import type { CreateAIConversationInput, UpdateAIConversationInput } from '@volt/contracts/modules/ai/http';
import ApplicationError from '@shared/errors/ApplicationError';
import type { PaginatedResult } from '@shared/persistence/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/persistence/paginate';
import { ErrorCodes } from '@core/constants/error-codes';

const DEFAULT_TITLE = 'New Conversation';

const CONVERSATION_PAGE_OPTIONS = {
    defaultLimit: 50,
    maxLimit: 200
};

const MESSAGE_PAGE_OPTIONS = {
    defaultLimit: 40,
    maxLimit: 100
};

export interface AIConversationScope {
    teamId: string;
    userId: string;
}

export interface AIConversationRef extends AIConversationScope {
    conversationId: string;
}

interface ListAIConversationsInput extends AIConversationScope {
    page?: number;
    limit?: number;
    includeArchived?: string | boolean;
}

interface ListAIConversationMessagesInput extends AIConversationRef {
    page?: number;
    limit?: number;
}

const notFound = (): ApplicationError => ApplicationError.notFound(ErrorCodes.AI_CONVERSATION_NOT_FOUND, 'AI conversation not found');

class ConversationService {
    async list(input: ListAIConversationsInput): Promise<PaginatedResult<AIConversation>> {
        const page = readPageRequest(input.page, input.limit, CONVERSATION_PAGE_OPTIONS);
        const where: FindOptionsWhere<AIConversation> = {
            teamId: input.teamId,
            userId: input.userId
        };

        if (input.includeArchived !== true && input.includeArchived !== 'true') where.isArchived = false;

        return paginate(await AIConversation.findAndCount({
            where,
            order: {
                lastMessageAt: 'DESC',
                createdAt: 'DESC'
            },
            take: page.limit,
            skip: skipFor(page)
        }), page);
    }

    create(scope: AIConversationScope, input: CreateAIConversationInput): Promise<AIConversation> {
        return AIConversation.create({
            teamId: scope.teamId,
            userId: scope.userId,
            title: input.title?.trim() || DEFAULT_TITLE,
            isArchived: false,
            lastMessageAt: null,
            provider: null,
            model: null,
            summary: null,
            summarizedThrough: 0
        }).save();
    }

    async owned({ conversationId, teamId, userId }: AIConversationRef): Promise<AIConversation> {
        const conversation = await AIConversation.findOneBy({
            id: conversationId,
            teamId,
            userId
        });
        if (!conversation) throw notFound();

        return conversation;
    }

    // For a socket, which names only the conversation: the conversation says which team it is in.
    async ownedBy(userId: string, conversationId: string): Promise<AIConversation> {
        const conversation = await AIConversation.findOneBy({
            id: conversationId,
            userId
        });
        if (!conversation) throw notFound();

        return conversation;
    }

    async update(ref: AIConversationRef, input: UpdateAIConversationInput): Promise<AIConversation> {
        const conversation = await this.owned(ref);

        if (input.title !== undefined) conversation.title = input.title.trim();
        if (input.isArchived !== undefined) conversation.isArchived = input.isArchived;

        return conversation.save();
    }

    async choose(conversation: AIConversation, choice: AIModelChoice): Promise<void> {
        if (conversation.provider === choice.provider && conversation.model === choice.model) return;

        conversation.provider = choice.provider;
        conversation.model = choice.model;
        await AIConversation.update({ id: conversation.id }, {
            provider: choice.provider,
            model: choice.model
        });
    }

    async delete(ref: AIConversationRef): Promise<void> {
        const conversation = await this.owned(ref);
        await AIConversation.delete({ id: conversation.id });
    }

    async messages(input: ListAIConversationMessagesInput): Promise<PaginatedResult<AIConversationMessage>> {
        const conversation = await this.owned(input);
        const page = readPageRequest(input.page, input.limit, MESSAGE_PAGE_OPTIONS);
        const [messages, total] = await chatMessageService.newest(conversation.id, page);

        return paginate([messages.map(wireMessageOf), total], page);
    }
}

export default new ConversationService();

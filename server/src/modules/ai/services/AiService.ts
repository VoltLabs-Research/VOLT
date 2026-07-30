import type { FindOptionsWhere } from 'typeorm';
import { ErrorCodes } from '@core/constants/error-codes';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';
import { AIConversationMessageRole } from '@modules/ai/contracts/ai-message';
import type {
    AIConversationMessage,
    AIMessageModelInfo,
    AIMessagePart,
    AIMessageParts,
    AIMessageTokenUsage,
    AIMessageToolStep
} from '@modules/ai/contracts/ai-message';
import type { AIChatFinishEvent, AIChatReplyStream } from '@modules/ai/services/AISDKChatTransport';
import aiSdkChatTransport from '@modules/ai/services/AISDKChatTransport';
import { mapAssistantResponseParts, mergeAssistantParts } from '@modules/ai/services/AIResponseMessagePartsMapper';
import TeamMember from '@modules/team/models/TeamMember';
import type { TeamAIProvider } from '@modules/team/contracts/team-ai-integration';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import logger from '@shared/infrastructure/logger';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';

type AITextPart = AIMessagePart & { text: string };

const CONVERSATION_PAGE_OPTIONS = {
    defaultLimit: 50,
    maxLimit: 200
};

const isTextPart = (part: AIMessagePart): part is AITextPart => (
    part.type === 'text' && typeof part.text === 'string'
);

const normalizeUIMessages = (messages?: AIConversationMessage[]): AIConversationMessage[] | null => {
    return messages?.length ? messages : null;
};

const extractLastUserMessageText = (messages: AIConversationMessage[]): string => {
    for(let index = messages.length - 1; index >= 0; index--){
        const message = messages[index];
        if(message.role !== AIConversationMessageRole.User){
            continue;
        }

        return message.parts
            .filter(isTextPart)
            .map((part) => part.text)
            .join('\n')
            .trim();
    }

    return '';
};

interface AIConversationView {
    _id: string;
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt?: Date | null;
    lastProvider?: string | null;
    lastModel?: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface AIMessageArtifactsView {
    items: Record<string, unknown>[];
}

interface AIMessageView {
    _id: string;
    conversationId: string;
    role: AIMessageRole;
    parts: AIMessageParts;
    content: string;
    artifacts: AIMessageArtifactsView | null;
    modelInfo: AIMessageModelInfo | null;
    tokenUsage: AIMessageTokenUsage | null;
    createdAt: Date;
    updatedAt: Date;
}

interface ListAIConversationsInput {
    teamId: string;
    userId: string;
    page?: number;
    limit?: number;
    includeArchived?: boolean | string;
}

interface CreateAIConversationInput {
    teamId: string;
    userId: string;
    title?: string;
    message?: string;
}

interface CreateAIConversationOutput {
    conversation: AIConversationView;
    userMessage?: AIMessageView;
}

interface ListAIConversationMessagesInput {
    teamId: string;
    userId: string;
    conversationId: string;
    page?: number;
    limit?: number;
}

interface SendAIConversationMessageInput {
    teamId: string;
    conversationId: string;
    userId: string;
    message?: string;
    messages?: AIConversationMessage[];
    title?: string;
    provider?: TeamAIProvider;
    model?: string;
}

interface SendAIConversationMessageOutput {
    streamResult: AIChatReplyStream;
    userMessage?: AIMessageView;
    assistantMessage?: Promise<AIMessageView | undefined>;
}

interface UpdateAIConversationInput {
    teamId: string;
    userId: string;
    conversationId: string;
    title?: string;
    isArchived?: boolean;
}

interface DeleteAIConversationInput {
    teamId: string;
    userId: string;
    conversationId: string;
}

interface ConversationUpdatePayload {
    lastMessageAt: Date;
    lastProvider: string;
    lastModel: string;
    title: string;
}

const VALID_ARTIFACT_KINDS = new Set<string>(['table', 'chart', 'image', 'text']);

export default class AiService{
    async listConversations(input: ListAIConversationsInput): Promise<PaginatedResult<AIConversationView>>{
        const pageRequest = readPageRequest(input.page, input.limit, CONVERSATION_PAGE_OPTIONS);
        const includeArchived = input.includeArchived === true || input.includeArchived === 'true';

        const where: FindOptionsWhere<AIConversation> = {
            teamId: input.teamId,
            userId: input.userId
        };

        if(!includeArchived){
            where.isArchived = false;
        }

        const [conversations, total] = await AIConversation.findAndCount({
            where,
            order: {
                lastMessageAt: 'DESC',
                updatedAt: 'DESC'
            },
            take: pageRequest.limit,
            skip: skipFor(pageRequest)
        });

        return paginate(
            [conversations.map((conversation) => this.#toConversationView(conversation)), total],
            pageRequest
        );
    }

    async createConversation(input: CreateAIConversationInput): Promise<CreateAIConversationOutput>{
        const title = input.title?.trim() || 'New Conversation';
        const normalizedMessage = input.message?.trim();

        if(normalizedMessage && title !== normalizedMessage){
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'title must match the first message'
            );
        }

        const now = new Date();
        const conversation = await AIConversation.create({
            teamId: input.teamId,
            userId: input.userId,
            title,
            isArchived: false,
            lastMessageAt: normalizedMessage
                ? now
                : null
        }).save();

        const userMessage = normalizedMessage
            ? await AIMessage.create({
                conversationId: conversation.id,
                role: AIMessageRole.User,
                parts: [
                    {
                        type: 'text',
                        text: normalizedMessage
                    }
                ],
                content: normalizedMessage,
                modelInfo: null,
                tokenUsage: null
            }).save()
            : null;

        return {
            conversation: this.#toConversationView(conversation),
            userMessage: userMessage
                ? this.#toMessageView(userMessage)
                : undefined
        };
    }

    async listMessages(input: ListAIConversationMessagesInput): Promise<PaginatedResult<AIMessageView>>{
        const pageRequest = readPageRequest(input.page, input.limit, CONVERSATION_PAGE_OPTIONS);

        const conversation = await this.#findOwnedConversation(
            input.conversationId,
            input.teamId,
            input.userId
        );

        if(!conversation){
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        const [messages, total] = await AIMessage.findAndCount({
            where: { conversationId: conversation.id },
            order: { createdAt: 'ASC' },
            take: pageRequest.limit,
            skip: skipFor(pageRequest)
        });

        return paginate(
            [messages.map((message) => this.#toMessageView(message)), total],
            pageRequest
        );
    }

    async streamMessage(input: SendAIConversationMessageInput): Promise<SendAIConversationMessageOutput>{
        const uiMessages = normalizeUIMessages(input.messages);

        if(!uiMessages){
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'UI messages are required'
            );
        }

        const member = await TeamMember.findOneBy({
            team: input.teamId,
            user: input.userId
        });

        if(!member){
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                'User is not a member of the selected team'
            );
        }

        const conversation = await this.#findOwnedConversation(
            input.conversationId,
            input.teamId,
            input.userId
        );

        if(!conversation){
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        const conversationId = conversation.id;
        const isContinuation = this.#isContinuationRequest(uiMessages);

        let userMessage: AIMessage | null = null;
        let existingAssistantMessage: AIMessage | null = null;

        if(isContinuation){
            existingAssistantMessage = await this.#findLastAssistantMessage(conversationId);
            logger.debug(
                'AI conversation %s: continuation detected, existing assistant message %s',
                conversationId,
                existingAssistantMessage?.id ?? 'not found'
            );
        }else{
            const userText = input.message?.trim() || extractLastUserMessageText(uiMessages);

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

        logger.debug(
            'AI conversation %s: sending %d normalized messages',
            conversationId,
            uiMessages.length
        );

        let resolveAssistantMessage: (message: AIMessageView | undefined) => void = () => undefined;
        let rejectAssistantMessage: (error: unknown) => void = () => undefined;
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
                messages: uiMessages,
                onFinish: async (event) => {
                    try{
                        const persistedAssistantMessage = await this.#persistAssistantResponse(
                            conversationId,
                            event,
                            existingAssistantMessage
                        );
                        const conversationUpdate: ConversationUpdatePayload = {
                            lastMessageAt: new Date(),
                            lastProvider: event.provider,
                            lastModel: event.model,
                            title: input.title?.trim() || conversation.title
                        };

                        await AIConversation.update({ id: conversationId }, conversationUpdate);
                        resolveAssistantMessage(persistedAssistantMessage);
                    }catch(error){
                        rejectAssistantMessage(error);
                        throw error;
                    }
                }
            });

            return {
                streamResult,
                userMessage: userMessage ? this.#toMessageView(userMessage) : undefined,
                assistantMessage
            };
        }catch(error){
            rejectAssistantMessage(error);
            throw error;
        }
    }

    async updateConversation(input: UpdateAIConversationInput): Promise<AIConversationView>{
        const conversation = await this.#findOwnedConversation(
            input.conversationId,
            input.teamId,
            input.userId
        );

        if(!conversation){
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        const updateData: Partial<Pick<AIConversation, 'title' | 'isArchived'>> = {};
        if(typeof input.title !== 'undefined') updateData.title = input.title.trim();
        if(typeof input.isArchived !== 'undefined') updateData.isArchived = input.isArchived;

        const updatedConversation = await AIConversation.findOneBy({ id: conversation.id });

        if(!updatedConversation){
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        return this.#toConversationView(await Object.assign(updatedConversation, updateData).save());
    }

    async deleteConversation(input: DeleteAIConversationInput): Promise<void>{
        const conversation = await this.#findOwnedConversation(
            input.conversationId,
            input.teamId,
            input.userId
        );

        if(!conversation){
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        await AIMessage.delete({ conversationId: conversation.id });
        await AIConversation.delete({ id: conversation.id });
    }

    #findOwnedConversation(
        conversationId: string,
        teamId: string,
        userId: string
    ): Promise<AIConversation | null>{
        return AIConversation.findOneBy({
            id: conversationId,
            teamId,
            userId
        });
    }

    #isContinuationRequest(uiMessages: AIConversationMessage[]): boolean{
        const lastMessage = uiMessages[uiMessages.length - 1];
        return lastMessage?.role === AIConversationMessageRole.Assistant;
    }

    async #findLastAssistantMessage(conversationId: string): Promise<AIMessage | null>{
        const messages = await AIMessage.find({
            where: {
                conversationId,
                role: AIMessageRole.Assistant
            },
            order: { createdAt: 'DESC' },
            take: 1
        });

        return messages.length > 0 ? messages[0] : null;
    }

    async #persistAssistantResponse(
        conversationId: string,
        event: AIChatFinishEvent,
        existingMessage?: AIMessage | null
    ): Promise<AIMessageView | undefined>{
        const { parts: newParts, textContent: newTextContent } = mapAssistantResponseParts(event.responseMessages);

        if(newParts.length === 0){
            return existingMessage ? this.#toMessageView(existingMessage) : undefined;
        }

        if(existingMessage){
            return this.#mergeAssistantResponse(existingMessage, event, newParts, newTextContent);
        }

        return this.#createAssistantResponse(conversationId, event, newParts, newTextContent);
    }

    async #mergeAssistantResponse(
        existingMessage: AIMessage,
        event: AIChatFinishEvent,
        newParts: AIMessageParts,
        newTextContent: string
    ): Promise<AIMessageView | undefined>{
        const mergedParts = mergeAssistantParts(
            existingMessage.parts,
            newParts
        );

        const mergedContent = [existingMessage.content, newTextContent]
            .filter(Boolean)
            .join('\n');

        const existingUsage = existingMessage.tokenUsage;
        const newUsage = event.totalUsage;

        const updatedMessage = await AIMessage.findOneBy({ id: existingMessage.id });

        if(!updatedMessage) return undefined;

        const merged = await Object.assign(updatedMessage, {
            parts: mergedParts,
            content: mergedContent,
            modelInfo: {
                provider: event.provider,
                model: event.model,
                finishReason: event.finishReason,
                steps: [
                    ...(existingMessage.modelInfo?.steps ?? []),
                    ...event.steps
                ]
            },
            tokenUsage: {
                inputTokens: (existingUsage?.inputTokens ?? 0) + (newUsage?.inputTokens ?? 0),
                outputTokens: (existingUsage?.outputTokens ?? 0) + (newUsage?.outputTokens ?? 0),
                totalTokens: (existingUsage?.totalTokens ?? 0) + (newUsage?.totalTokens ?? 0)
            }
        }).save();

        return this.#toMessageView(merged);
    }

    async #createAssistantResponse(
        conversationId: string,
        event: AIChatFinishEvent,
        parts: AIMessageParts,
        textContent: string
    ): Promise<AIMessageView>{
        const assistantMessage = await AIMessage.create({
            conversationId,
            role: AIMessageRole.Assistant,
            parts,
            content: textContent,
            modelInfo: {
                provider: event.provider,
                model: event.model,
                finishReason: event.finishReason,
                steps: event.steps
            },
            tokenUsage: {
                inputTokens: event.totalUsage?.inputTokens ?? 0,
                outputTokens: event.totalUsage?.outputTokens ?? 0,
                totalTokens: event.totalUsage?.totalTokens ?? 0
            }
        }).save();

        return this.#toMessageView(assistantMessage);
    }

    #toConversationView(conversation: AIConversation): AIConversationView{
        return {
            _id: conversation.id,
            userId: conversation.userId,
            teamId: conversation.teamId,
            title: conversation.title,
            lastMessageAt: conversation.lastMessageAt ?? null,
            lastProvider: conversation.lastProvider ?? null,
            lastModel: conversation.lastModel ?? null,
            isArchived: conversation.isArchived,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt
        };
    }

    #toMessageView(message: AIMessage): AIMessageView{
        const messageId = message.id;
        const steps = message.modelInfo?.steps ?? [];
        const artifactItems = this.#extractArtifacts(messageId, steps);

        return {
            _id: messageId,
            conversationId: message.conversationId,
            role: message.role,
            parts: message.parts,
            content: message.content,
            artifacts: artifactItems.length > 0
                ? {
                    items: artifactItems
                }
                : null,
            modelInfo: message.modelInfo,
            tokenUsage: message.tokenUsage,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt
        };
    }

    #extractArtifacts(messageId: string, steps: AIMessageToolStep[]): Record<string, unknown>[]{
        const items: Record<string, unknown>[] = [];

        for(let stepIndex = 0; stepIndex < steps.length; stepIndex++){
            const step = steps[stepIndex];

            for(let resultIndex = 0; resultIndex < step.toolResults.length; resultIndex++){
                const result = step.toolResults[resultIndex];
                if(!isRecord(result.output)) continue;

                const output = result.output;
                let payloadType = 'unknown';
                if(typeof output.payloadType === 'string'){
                    payloadType = output.payloadType;
                }
                const kind = VALID_ARTIFACT_KINDS.has(payloadType) ? payloadType : 'unknown';

                items.push({
                    id: `${messageId}:step-${stepIndex}:tool-result-${resultIndex}`,
                    messageId,
                    kind,
                    title: result.toolName,
                    summary: output.summary,
                    payload: output,
                    toolName: result.toolName
                });
            }
        }

        return items;
    }
}

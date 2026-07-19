import { ErrorCodes } from '@core/constants/error-codes';
import type { AIConversationMessage, AIConversationMessageParts } from '@modules/ai/contracts/AIConversationMessage';
import { AIConversationMessageRole } from '@modules/ai/contracts/AIConversationMessage';
import AIConversationModel from '@modules/ai/models/AIConversationModel';
import type { AIConversationProps, AIConversationDocument } from '@modules/ai/models/AIConversationModel';
import AIMessageModel, { AIMessageRole } from '@modules/ai/models/AIMessageModel';
import type {
    AIMessageProps,
    AIMessageDocument,
    AIMessageModelInfo,
    AIMessageTokenUsage,
    AIMessageToolStep
} from '@modules/ai/models/AIMessageModel';
import type { AIChatFinishEvent, AIChatReplyStream } from '@modules/ai/services/AISDKChatTransport';
import aiSdkChatTransport from '@modules/ai/services/AISDKChatTransport';
import { mapAssistantResponseParts, mergeAssistantParts } from '@modules/ai/utilities/AIResponseMessagePartsMapper';
import { extractLastUserMessageText, normalizeUIMessages } from '@modules/ai/utilities/AIUIMessageUtils';
import TeamMemberModel from '@modules/team/models/team-member/TeamMemberModel';
import type { TeamAIProvider } from '@modules/team/models/ai-integration/TeamAIIntegrationModel';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import logger from '@shared/infrastructure/logger';

export interface AIConversationView {
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

export interface AIMessageView {
    _id: string;
    conversationId: string;
    role: AIMessageRole;
    parts: AIConversationMessageParts;
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

export default class AiService {
    async listConversations(input: ListAIConversationsInput): Promise<PaginatedResult<AIConversationView>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(200, input.limit ?? 50));
        const includeArchived = input.includeArchived === true || input.includeArchived === 'true';

        const filter: Record<string, unknown> = {
            teamId: input.teamId,
            userId: input.userId
        };

        if (!includeArchived) {
            filter.isArchived = false;
        }

        const [docs, total] = await Promise.all([
            AIConversationModel.find(filter)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({
                    lastMessageAt: -1,
                    updatedAt: -1
                })
                .exec(),
            AIConversationModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.#toConversationView(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async createConversation(input: CreateAIConversationInput): Promise<CreateAIConversationOutput> {
        const title = input.title?.trim() || 'New Conversation';
        const normalizedMessage = input.message?.trim();

        if (normalizedMessage && title !== normalizedMessage) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'title must match the first message'
            );
        }

        const now = new Date();
        const conversation = await AIConversationModel.create({
            teamId: input.teamId,
            userId: input.userId,
            title,
            isArchived: false,
            lastMessageAt: normalizedMessage
                ? now
                : null
        });

        const userMessage = normalizedMessage
            ? await AIMessageModel.create({
                conversationId: conversation._id,
                role: AIMessageRole.User,
                parts: [
                    {
                        type: 'text',
                        text: normalizedMessage
                    }
                ],
                content: normalizedMessage,
                modelInfo: null,
                tokenUsage: null,
                createdAt: now,
                updatedAt: now
            })
            : null;

        return {
            conversation: this.#toConversationView(conversation),
            userMessage: userMessage
                ? this.#toMessageView(userMessage)
                : undefined
        };
    }

    async listMessages(input: ListAIConversationMessagesInput): Promise<PaginatedResult<AIMessageView>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(200, input.limit ?? 50));

        const conversation = await this.#findOwnedConversation(
            input.conversationId,
            input.teamId,
            input.userId
        );

        if (!conversation) {
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        const messageFilter = { conversationId: conversation._id };
        const [docs, total] = await Promise.all([
            AIMessageModel.find(messageFilter)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ createdAt: 1 })
                .exec(),
            AIMessageModel.countDocuments(messageFilter)
        ]);

        return {
            data: docs.map((doc) => this.#toMessageView(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async streamMessage(input: SendAIConversationMessageInput): Promise<SendAIConversationMessageOutput> {
        const uiMessages = normalizeUIMessages(input.messages);

        if (!uiMessages) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'UI messages are required'
            );
        }

        const member = await TeamMemberModel.findOne({
            team: input.teamId,
            user: input.userId
        }).exec();

        if (!member) {
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

        if (!conversation) {
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        const conversationId = String(conversation._id);
        const isContinuation = this.#isContinuationRequest(uiMessages);

        let userMessage: AIMessageDocument | null = null;
        let existingAssistantMessage: AIMessageDocument | null = null;

        if (isContinuation) {
            existingAssistantMessage = await this.#findLastAssistantMessage(conversationId);
            logger.debug(
                'AI conversation %s: continuation detected, existing assistant message %s',
                conversationId,
                existingAssistantMessage?._id ?? 'not found'
            );
        } else {
            const userText = input.message?.trim() || extractLastUserMessageText(uiMessages);

            if (userText) {
                const now = new Date();
                userMessage = await AIMessageModel.create({
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
                    tokenUsage: null,
                    createdAt: now,
                    updatedAt: now
                });
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

        try {
            const streamResult = await aiSdkChatTransport.generateReplyStream({
                teamId: input.teamId,
                userId: input.userId,
                provider: input.provider,
                model: input.model,
                messages: uiMessages,
                onFinish: async (event) => {
                    try {
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

                        await AIConversationModel.updateOne(
                            { _id: conversationId },
                            { $set: conversationUpdate }
                        );
                        resolveAssistantMessage(persistedAssistantMessage);
                    } catch (error) {
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
        } catch (error) {
            rejectAssistantMessage(error);
            throw error;
        }
    }

    async updateConversation(input: UpdateAIConversationInput): Promise<AIConversationView> {
        const conversation = await this.#findOwnedConversation(
            input.conversationId,
            input.teamId,
            input.userId
        );

        if (!conversation) {
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        const updateData: Partial<AIConversationProps> = {};
        if (typeof input.title !== 'undefined') updateData.title = input.title.trim();
        if (typeof input.isArchived !== 'undefined') updateData.isArchived = input.isArchived;

        const updatedConversation = await AIConversationModel.findByIdAndUpdate(
            conversation._id,
            { $set: updateData },
            { new: true }
        ).exec();

        if (!updatedConversation) {
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        return this.#toConversationView(updatedConversation);
    }

    async deleteConversation(input: DeleteAIConversationInput): Promise<void> {
        const conversation = await this.#findOwnedConversation(
            input.conversationId,
            input.teamId,
            input.userId
        );

        if (!conversation) {
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        await AIMessageModel.deleteMany({ conversationId: conversation._id });
        await AIConversationModel.deleteOne({ _id: conversation._id });
    }

    #findOwnedConversation(
        conversationId: string,
        teamId: string,
        userId: string
    ): Promise<AIConversationDocument | null> {
        return AIConversationModel.findOne({ _id: conversationId, teamId, userId }).exec();
    }

    #isContinuationRequest(uiMessages: AIConversationMessage[]): boolean {
        const lastMessage = uiMessages[uiMessages.length - 1];
        return lastMessage?.role === AIConversationMessageRole.Assistant;
    }

    async #findLastAssistantMessage(conversationId: string): Promise<AIMessageDocument | null> {
        const docs = await AIMessageModel.find({
            conversationId,
            role: AIMessageRole.Assistant
        })
            .sort({ createdAt: -1 })
            .limit(1)
            .exec();

        return docs.length > 0 ? docs[0] : null;
    }

    async #persistAssistantResponse(
        conversationId: string,
        event: AIChatFinishEvent,
        existingMessage?: AIMessageDocument | null
    ): Promise<AIMessageView | undefined> {
        const { parts: newParts, textContent: newTextContent } = mapAssistantResponseParts(event.responseMessages);

        if (newParts.length === 0) {
            return existingMessage ? this.#toMessageView(existingMessage) : undefined;
        }

        if (existingMessage) {
            return this.#mergeAssistantResponse(existingMessage, event, newParts, newTextContent);
        }

        return this.#createAssistantResponse(conversationId, event, newParts, newTextContent);
    }

    async #mergeAssistantResponse(
        existingMessage: AIMessageDocument,
        event: AIChatFinishEvent,
        newParts: AIMessageProps['parts'],
        newTextContent: string
    ): Promise<AIMessageView | undefined> {
        const existing = existingMessage.toObject({ flattenMaps: true }) as unknown as AIMessageProps;

        const mergedParts = mergeAssistantParts(
            existing.parts,
            newParts
        );

        const mergedContent = [existing.content, newTextContent]
            .filter(Boolean)
            .join('\n');

        const existingUsage = existing.tokenUsage;
        const newUsage = event.totalUsage;

        const updatedMessage = await AIMessageModel.findByIdAndUpdate(
            existingMessage._id,
            {
                $set: {
                    parts: mergedParts,
                    content: mergedContent,
                    modelInfo: {
                        provider: event.provider,
                        model: event.model,
                        finishReason: event.finishReason,
                        steps: [
                            ...(existing.modelInfo?.steps ?? []),
                            ...event.steps
                        ]
                    },
                    tokenUsage: {
                        inputTokens: (existingUsage?.inputTokens ?? 0) + (newUsage?.inputTokens ?? 0),
                        outputTokens: (existingUsage?.outputTokens ?? 0) + (newUsage?.outputTokens ?? 0),
                        totalTokens: (existingUsage?.totalTokens ?? 0) + (newUsage?.totalTokens ?? 0)
                    },
                    updatedAt: new Date()
                }
            },
            { new: true }
        ).exec();

        if (!updatedMessage) return undefined;
        return this.#toMessageView(updatedMessage);
    }

    async #createAssistantResponse(
        conversationId: string,
        event: AIChatFinishEvent,
        parts: AIMessageProps['parts'],
        textContent: string
    ): Promise<AIMessageView> {
        const now = new Date();
        const assistantMessage = await AIMessageModel.create({
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
            },
            createdAt: now,
            updatedAt: now
        });

        return this.#toMessageView(assistantMessage);
    }

    #toConversationView(doc: AIConversationDocument): AIConversationView {
        const props = doc.toObject({ flattenMaps: true }) as unknown as AIConversationProps;

        return {
            _id: String(doc._id),
            userId: String(props.userId),
            teamId: String(props.teamId),
            title: props.title,
            lastMessageAt: props.lastMessageAt ?? null,
            lastProvider: props.lastProvider ?? null,
            lastModel: props.lastModel ?? null,
            isArchived: props.isArchived,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        };
    }

    #toMessageView(doc: AIMessageDocument): AIMessageView {
        const props = doc.toObject({ flattenMaps: true }) as unknown as AIMessageProps;
        const messageId = String(doc._id);
        const steps = props.modelInfo?.steps ?? [];
        const artifactItems = this.#extractArtifacts(messageId, steps);

        return {
            _id: messageId,
            conversationId: String(props.conversationId),
            role: props.role,
            parts: props.parts,
            content: props.content,
            artifacts: artifactItems.length > 0
                ? {
                    items: artifactItems
                }
                : null,
            modelInfo: props.modelInfo,
            tokenUsage: props.tokenUsage,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        };
    }

    #extractArtifacts(messageId: string, steps: AIMessageToolStep[]): Record<string, unknown>[] {
        const items: Record<string, unknown>[] = [];

        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            const step = steps[stepIndex];

            for (let resultIndex = 0; resultIndex < step.toolResults.length; resultIndex++) {
                const result = step.toolResults[resultIndex];
                if (!isRecord(result.output)) continue;

                const output = result.output;
                let payloadType = 'unknown';
                if (typeof output.payloadType === 'string') {
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

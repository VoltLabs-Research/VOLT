import { ErrorCodes } from '@core/constants/error-codes';
import type { CreateAIConversationInputDTO, CreateAIConversationOutputDTO } from '@modules/ai/dtos/CreateAIConversationDTO';
import type { DeleteAIConversationInputDTO } from '@modules/ai/dtos/DeleteAIConversationDTO';
import { AIMessageDTO, ListAIConversationMessagesInputDTO } from '@modules/ai/dtos/ListAIConversationMessagesDTO';
import { AIConversationDTO, ListAIConversationsInputDTO } from '@modules/ai/dtos/ListAIConversationsDTO';
import { SendAIConversationMessageInputDTO, SendAIConversationMessageOutputDTO } from '@modules/ai/dtos/SendAIConversationMessageDTO';
import type { UpdateAIConversationInputDTO } from '@modules/ai/dtos/UpdateAIConversationDTO';
import type { AIConversationMessage } from '@modules/ai/contracts/AIConversationMessage';
import { AIConversationMessageRole } from '@modules/ai/contracts/AIConversationMessage';
import type { AIConversationProps } from '@modules/ai/entities/AIConversation';
import type { AIMessageProps } from '@modules/ai/entities/AIMessage';
import AIMessage, { AIMessageRole } from '@modules/ai/entities/AIMessage';
import type { AIChatFinishEvent } from '@modules/ai/ports/IAIChatTransport';
import type { IAIChatTransport } from '@modules/ai/ports/IAIChatTransport';
import type { IAIConversationRepository } from '@modules/ai/ports/IAIConversationRepository';
import type { IAIMessageRepository } from '@modules/ai/ports/IAIMessageRepository';
import { AI_TOKENS } from '@modules/ai/di/AITokens';
import AIMessageDTOMapper from '@modules/ai/utilities/AIMessageDTOMapper';
import AIResponseMessagePartsMapper from '@modules/ai/utilities/AIResponseMessagePartsMapper';
import AIUIMessageUtils from '@modules/ai/utilities/AIUIMessageUtils';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { TeamMemberProps } from '@modules/team/entities/team-member/TeamMember';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import logger from '@shared/infrastructure/logger';
import { container as diContainer } from 'tsyringe';

interface ConversationUpdatePayload {
    lastMessageAt: Date;
    lastProvider: string;
    lastModel: string;
    title: string;
}

interface TeamMemberLookupFilter extends Partial<TeamMemberProps> {
    team: string;
    user: string;
}

interface LastAssistantMessageFilter extends Partial<AIMessageProps> {
    conversationId: string;
    role: AIMessageRole;
}

interface ListAIConversationsFilter extends Partial<AIConversationProps> {
    teamId: string;
    userId: string;
}

/**
 * The single application service for the ai module (pollium style): folds every
 * ai HTTP use case verbatim (including the former List/Update/Delete
 * conversation use cases, now inlined here and reused by the conversation AI
 * tools). Its collaborators are genuinely-stateful / complex shared singletons —
 * the AI-SDK chat transport (streaming + tool registry), the conversation /
 * message repositories, the cross-module team-member repository, and the
 * message DTO / UI-message / response-parts mappers — resolved once from the DI
 * container via their neutral tokens. Throws typed `ApplicationError`s (no
 * Result channel).
 */
export default class AiService {
    #conversationRepository = diContainer.resolve<IAIConversationRepository>(AI_TOKENS.AIConversationRepository);
    #messageRepository = diContainer.resolve<IAIMessageRepository>(AI_TOKENS.AIMessageRepository);
    #teamMemberRepository = diContainer.resolve<ITeamMemberRepository>(TEAM_CONTRACT_TOKENS.TeamMemberRepository);
    // Lazy: the transport resolves the AI-tool collection, and AI tools `new AiService()`,
    // so eager resolution here would be a construction-time cycle. Deferred to first chat use.
    #aiChatTransportCache?: IAIChatTransport;
    get #aiChatTransport(): IAIChatTransport {
        return (this.#aiChatTransportCache ??= diContainer.resolve<IAIChatTransport>(AI_TOKENS.AIChatTransport));
    }
    #messageDTOMapper = diContainer.resolve<AIMessageDTOMapper>(AI_TOKENS.AIMessageDTOMapper);
    #uiMessageUtils = diContainer.resolve<AIUIMessageUtils>(AI_TOKENS.AIUIMessageUtils);
    #responseMessagePartsMapper = diContainer.resolve<AIResponseMessagePartsMapper>(AI_TOKENS.AIResponseMessagePartsMapper);

    async listConversations(input: ListAIConversationsInputDTO): Promise<PaginatedResult<AIConversationDTO>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(200, input.limit ?? 50));
        const includeArchived = input.includeArchived === true || input.includeArchived === 'true';

        const filter: ListAIConversationsFilter = {
            teamId: input.teamId,
            userId: input.userId
        };

        if (!includeArchived) {
            filter.isArchived = false;
        }

        const result = await this.#conversationRepository.findAll({
            filter,
            page,
            limit,
            sort: {
                lastMessageAt: -1,
                updatedAt: -1
            }
        });

        return {
            ...result,
            data: result.data.map((conversation) => ({
                _id: conversation._id,
                ...conversation.props
            }))
        };
    }

    async createConversation(input: CreateAIConversationInputDTO): Promise<CreateAIConversationOutputDTO> {
        const title = input.title?.trim() || 'New Conversation';
        const normalizedMessage = input.message?.trim();

        if (normalizedMessage && title !== normalizedMessage) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'title must match the first message'
            );
        }

        const now = new Date();
        const conversationData: Partial<AIConversationProps> = {
            teamId: input.teamId,
            userId: input.userId,
            title,
            isArchived: false,
            lastMessageAt: normalizedMessage
                ? now
                : null
        };
        const conversation = await this.#conversationRepository.create(conversationData);

        const userMessage = normalizedMessage
            ? await this.#messageRepository.create({
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
            } satisfies Partial<AIMessageProps>)
            : null;

        return {
            conversation: {
                _id: conversation._id,
                ...conversation.props
            },
            userMessage: userMessage
                ? this.#messageDTOMapper.toDTO(userMessage)
                : undefined
        };
    }

    async listMessages(input: ListAIConversationMessagesInputDTO): Promise<PaginatedResult<AIMessageDTO>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(200, input.limit ?? 50));

        const conversation = await this.#conversationRepository.findOwnedByUser(
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

        const result = await this.#messageRepository.findAll({
            filter: {
                conversationId: conversation._id
            },
            page,
            limit,
            sort: {
                createdAt: 1
            }
        });

        return {
            ...result,
            data: result.data.map((msg) => this.#messageDTOMapper.toDTO(msg))
        };
    }

    async streamMessage(input: SendAIConversationMessageInputDTO): Promise<SendAIConversationMessageOutputDTO> {
        const uiMessages = this.#uiMessageUtils.normalizeUIMessages(input.messages);

        if (!uiMessages) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'UI messages are required'
            );
        }

        const member = await this.#teamMemberRepository.findOne({
            team: input.teamId,
            user: input.userId
        } satisfies TeamMemberLookupFilter);

        if (!member) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                'User is not a member of the selected team'
            );
        }

        const conversation = await this.#conversationRepository.findOwnedByUser(
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

        const isContinuation = this.#isContinuationRequest(uiMessages);

        let userMessage: AIMessage | null = null;
        let existingAssistantMessage: AIMessage | null = null;

        if (isContinuation) {
            existingAssistantMessage = await this.#findLastAssistantMessage(conversation._id);
            logger.debug(
                'AI conversation %s: continuation detected, existing assistant message %s',
                conversation._id,
                existingAssistantMessage?._id ?? 'not found'
            );
        } else {
            const userText = input.message?.trim() || this.#uiMessageUtils.extractLastUserMessageText(uiMessages);

            if (userText) {
                const now = new Date();
                userMessage = await this.#messageRepository.create({
                    conversationId: conversation._id,
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
                } satisfies Partial<AIMessageProps>);
            }
        }

        logger.debug(
            'AI conversation %s: sending %d normalized messages',
            conversation._id,
            uiMessages.length
        );

        let resolveAssistantMessage: (message: AIMessageDTO | undefined) => void = () => undefined;
        let rejectAssistantMessage: (error: unknown) => void = () => undefined;
        const assistantMessage = new Promise<AIMessageDTO | undefined>((resolve, reject) => {
            resolveAssistantMessage = resolve;
            rejectAssistantMessage = reject;
        });

        try {
            const streamResult = await this.#aiChatTransport.generateReplyStream({
                teamId: input.teamId,
                userId: input.userId,
                provider: input.provider,
                model: input.model,
                messages: uiMessages,
                onFinish: async (event) => {
                    try {
                        const persistedAssistantMessage = await this.#persistAssistantResponse(
                            conversation._id,
                            event,
                            existingAssistantMessage
                        );
                        const conversationUpdate: ConversationUpdatePayload = {
                            lastMessageAt: new Date(),
                            lastProvider: event.provider,
                            lastModel: event.model,
                            title: input.title?.trim() || conversation.props.title
                        };

                        await this.#conversationRepository.updateById(conversation._id, conversationUpdate);
                        resolveAssistantMessage(persistedAssistantMessage);
                    } catch (error) {
                        rejectAssistantMessage(error);
                        throw error;
                    }
                }
            });

            return {
                streamResult,
                userMessage: userMessage ? this.#toDTO(userMessage) : undefined,
                assistantMessage
            };
        } catch (error) {
            rejectAssistantMessage(error);
            throw error;
        }
    }

    async updateConversation(input: UpdateAIConversationInputDTO): Promise<AIConversationDTO> {
        const conversation = await this.#conversationRepository.findOwnedByUser(
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

        const updatedConversation = await this.#conversationRepository.updateById(conversation._id, updateData);

        if (!updatedConversation) {
            throw ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            );
        }

        return {
            _id: updatedConversation._id,
            ...updatedConversation.props
        };
    }

    async deleteConversation(input: DeleteAIConversationInputDTO): Promise<void> {
        const conversation = await this.#conversationRepository.findOwnedByUser(
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

        await this.#messageRepository.deleteMany({
            conversationId: conversation._id
        });

        await this.#conversationRepository.deleteById(conversation._id);
    }

    #isContinuationRequest(uiMessages: AIConversationMessage[]): boolean {
        const lastMessage = uiMessages[uiMessages.length - 1];
        return lastMessage?.role === AIConversationMessageRole.Assistant;
    }

    async #findLastAssistantMessage(conversationId: string): Promise<AIMessage | null> {
        const result = await this.#messageRepository.findAll({
            filter: {
                conversationId,
                role: AIMessageRole.Assistant
            } satisfies LastAssistantMessageFilter,
            sort: { createdAt: -1 },
            limit: 1
        });

        if (result.data.length === 0) return null;
        return result.data[0];
    }

    async #persistAssistantResponse(
        conversationId: string,
        event: AIChatFinishEvent,
        existingMessage?: AIMessage | null
    ): Promise<AIMessageDTO | undefined> {
        const { parts: newParts, textContent: newTextContent } = this.#responseMessagePartsMapper.mapAssistantResponseParts(event.responseMessages);

        if (newParts.length === 0) {
            return existingMessage ? this.#toDTO(existingMessage) : undefined;
        }

        if (existingMessage) {
            return this.#mergeAssistantResponse(existingMessage, event, newParts, newTextContent);
        }

        return this.#createAssistantResponse(conversationId, event, newParts, newTextContent);
    }

    async #mergeAssistantResponse(
        existingMessage: AIMessage,
        event: AIChatFinishEvent,
        newParts: AIMessageProps['parts'],
        newTextContent: string
    ): Promise<AIMessageDTO | undefined> {
        const mergedParts = this.#responseMessagePartsMapper.mergeAssistantParts(
            existingMessage.props.parts,
            newParts
        );

        const mergedContent = [existingMessage.props.content, newTextContent]
            .filter(Boolean)
            .join('\n');

        const existingUsage = existingMessage.props.tokenUsage;
        const newUsage = event.totalUsage;

        const updatedMessage = await this.#messageRepository.updateById(existingMessage._id, {
            parts: mergedParts,
            content: mergedContent,
            modelInfo: {
                provider: event.provider,
                model: event.model,
                finishReason: event.finishReason,
                steps: [
                    ...(existingMessage.props.modelInfo?.steps ?? []),
                    ...event.steps
                ]
            },
            tokenUsage: {
                inputTokens: (existingUsage?.inputTokens ?? 0) + (newUsage?.inputTokens ?? 0),
                outputTokens: (existingUsage?.outputTokens ?? 0) + (newUsage?.outputTokens ?? 0),
                totalTokens: (existingUsage?.totalTokens ?? 0) + (newUsage?.totalTokens ?? 0)
            },
            updatedAt: new Date()
        });

        if (!updatedMessage) return undefined;
        return this.#toDTO(updatedMessage);
    }

    async #createAssistantResponse(
        conversationId: string,
        event: AIChatFinishEvent,
        parts: AIMessageProps['parts'],
        textContent: string
    ): Promise<AIMessageDTO> {
        const now = new Date();
        const assistantMessage = await this.#messageRepository.create({
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
        } satisfies Partial<AIMessageProps>);

        return this.#toDTO(assistantMessage);
    }

    #toDTO(message: AIMessage): AIMessageDTO {
        return this.#messageDTOMapper.toDTO(message);
    }
}

import { ErrorCodes } from '@core/constants/error-codes';
import type { CreateAIConversationInputDTO, CreateAIConversationOutputDTO } from '@modules/ai/dtos/CreateAIConversationDTO';
import type { DeleteAIConversationInputDTO } from '@modules/ai/dtos/DeleteAIConversationDTO';
import { AIMessageDTO, ListAIConversationMessagesInputDTO } from '@modules/ai/dtos/ListAIConversationMessagesDTO';
import { AIConversationDTO, ListAIConversationsInputDTO } from '@modules/ai/dtos/ListAIConversationsDTO';
import { SendAIConversationMessageInputDTO, SendAIConversationMessageOutputDTO } from '@modules/ai/dtos/SendAIConversationMessageDTO';
import type { UpdateAIConversationInputDTO } from '@modules/ai/dtos/UpdateAIConversationDTO';
import DeleteAIConversationUseCase from '@modules/ai/use-cases/DeleteAIConversationUseCase';
import ListAIConversationsUseCase from '@modules/ai/use-cases/ListAIConversationsUseCase';
import UpdateAIConversationUseCase from '@modules/ai/use-cases/UpdateAIConversationUseCase';
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
import type { TeamMemberProps } from '@modules/team/entities/team-member/TeamMember';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

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

/**
 * The single application service for the ai module. Each method folds the exact
 * logic of a previously separate use case, converting the Result error channel
 * to thrown `ApplicationError`s so Express 5 forwards them to the global error
 * middleware. `listConversations`, `updateConversation` and `deleteConversation`
 * delegate to the retained use cases (still consumed by the AI tool registry),
 * mirroring the auth module's `updateAccount` delegator.
 */
@Singleton(AI_TOKENS.AiService)
export default class AiService {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository) private readonly conversationRepository: IAIConversationRepository,
        @inject(AI_TOKENS.AIMessageRepository) private readonly messageRepository: IAIMessageRepository,
        @inject(TEAM_CONTRACT_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(AI_TOKENS.AIChatTransport) private readonly aiChatTransport: IAIChatTransport,
        @inject(AI_TOKENS.AIMessageDTOMapper) private readonly messageDTOMapper: AIMessageDTOMapper,
        @inject(AI_TOKENS.AIUIMessageUtils) private readonly uiMessageUtils: AIUIMessageUtils,
        @inject(AI_TOKENS.AIResponseMessagePartsMapper) private readonly responseMessagePartsMapper: AIResponseMessagePartsMapper,
        @inject(ListAIConversationsUseCase) private readonly listConversationsUseCase: ListAIConversationsUseCase,
        @inject(UpdateAIConversationUseCase) private readonly updateConversationUseCase: UpdateAIConversationUseCase,
        @inject(DeleteAIConversationUseCase) private readonly deleteConversationUseCase: DeleteAIConversationUseCase
    ) {}

    /**
     * Thin delegator to the retained {@link ListAIConversationsUseCase} (still
     * used by the list-conversations AI tool). Unwraps the Result to the
     * thrown-error channel used by every other AiService method.
     */
    async listConversations(input: ListAIConversationsInputDTO): Promise<PaginatedResult<AIConversationDTO>> {
        return this.listConversationsUseCase.execute(input);
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
        const conversation = await this.conversationRepository.create(conversationData);

        const userMessage = normalizedMessage
            ? await this.messageRepository.create({
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
                ? this.messageDTOMapper.toDTO(userMessage)
                : undefined
        };
    }

    async listMessages(input: ListAIConversationMessagesInputDTO): Promise<PaginatedResult<AIMessageDTO>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(200, input.limit ?? 50));

        const conversation = await this.conversationRepository.findOwnedByUser(
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

        const result = await this.messageRepository.findAll({
            filter: {
                conversationId: conversation._id
            },
            page,
            limit,
            sort: {
                createdAt: 1
            }
        });

        const data: AIMessageDTO[] = result.data.map((msg) => this.messageDTOMapper.toDTO(msg));

        return {
            ...result,
            data
        };
    }

    async streamMessage(input: SendAIConversationMessageInputDTO): Promise<SendAIConversationMessageOutputDTO> {
        const uiMessages = this.uiMessageUtils.normalizeUIMessages(input.messages);

        if (!uiMessages) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'UI messages are required'
            );
        }

        const member = await this.teamMemberRepository.findOne({
            team: input.teamId,
            user: input.userId
        } satisfies TeamMemberLookupFilter);

        if (!member) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                'User is not a member of the selected team'
            );
        }

        const conversation = await this.conversationRepository.findOwnedByUser(
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

        const isContinuation = this.isContinuationRequest(uiMessages);

        let userMessage: AIMessage | null = null;
        let existingAssistantMessage: AIMessage | null = null;

        if (isContinuation) {
            existingAssistantMessage = await this.findLastAssistantMessage(conversation._id);
            logger.debug(
                'AI conversation %s: continuation detected, existing assistant message %s',
                conversation._id,
                existingAssistantMessage?._id ?? 'not found'
            );
        } else {
            const userText = input.message?.trim() || this.uiMessageUtils.extractLastUserMessageText(uiMessages);

            if (userText) {
                const now = new Date();
                userMessage = await this.messageRepository.create({
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
            const streamResult = await this.aiChatTransport.generateReplyStream({
                teamId: input.teamId,
                userId: input.userId,
                provider: input.provider,
                model: input.model,
                messages: uiMessages,
                onFinish: async (event) => {
                    try {
                        const persistedAssistantMessage = await this.persistAssistantResponse(
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

                        await this.conversationRepository.updateById(conversation._id, conversationUpdate);
                        resolveAssistantMessage(persistedAssistantMessage);
                    } catch (error) {
                        rejectAssistantMessage(error);
                        throw error;
                    }
                }
            });

            return {
                streamResult,
                userMessage: userMessage ? this.toDTO(userMessage) : undefined,
                assistantMessage
            };
        } catch (error) {
            rejectAssistantMessage(error);
            throw error;
        }
    }

    /**
     * Thin delegator to the retained {@link UpdateAIConversationUseCase} (still
     * used by the update-conversation AI tool). Unwraps the Result to the
     * thrown-error channel used by every other AiService method.
     */
    async updateConversation(input: UpdateAIConversationInputDTO): Promise<AIConversationDTO> {
        return this.updateConversationUseCase.execute(input);
    }

    /**
     * Thin delegator to the retained {@link DeleteAIConversationUseCase} (still
     * used by the delete-conversation AI tool). Unwraps the Result to the
     * thrown-error channel used by every other AiService method.
     */
    async deleteConversation(input: DeleteAIConversationInputDTO): Promise<void> {
        await this.deleteConversationUseCase.execute(input);
    }

    /**
     * Determines whether a request is a continuation after tool approval
     * rather than a fresh user turn.
     *
     * When `sendAutomaticallyWhen` triggers on the client, it re-sends the
     * full message history whose last entry is the existing assistant message
     * (with tool-call / approval-responded parts). A normal user turn always
     * ends with a user message.
     */
    private isContinuationRequest(uiMessages: AIConversationMessage[]): boolean {
        const lastMessage = uiMessages[uiMessages.length - 1];
        return lastMessage?.role === AIConversationMessageRole.Assistant;
    }

    /**
     * Retrieves the most recently created assistant message in a conversation.
     */
    private async findLastAssistantMessage(conversationId: string): Promise<AIMessage | null> {
        const result = await this.messageRepository.findAll({
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

    /**
     * Persists the assistant response — either by creating a new message
     * or by merging into an existing one when this is a continuation.
     */
    private async persistAssistantResponse(
        conversationId: string,
        event: AIChatFinishEvent,
        existingMessage?: AIMessage | null
    ): Promise<AIMessageDTO | undefined> {
        const { parts: newParts, textContent: newTextContent } = this.responseMessagePartsMapper.mapAssistantResponseParts(event.responseMessages);

        if (newParts.length === 0) {
            return existingMessage ? this.toDTO(existingMessage) : undefined;
        }

        if (existingMessage) {
            return this.mergeAssistantResponse(existingMessage, event, newParts, newTextContent);
        }

        return this.createAssistantResponse(conversationId, event, newParts, newTextContent);
    }

    private async mergeAssistantResponse(
        existingMessage: AIMessage,
        event: AIChatFinishEvent,
        newParts: AIMessageProps['parts'],
        newTextContent: string
    ): Promise<AIMessageDTO | undefined> {
        const mergedParts = this.responseMessagePartsMapper.mergeAssistantParts(
            existingMessage.props.parts,
            newParts
        );

        const mergedContent = [existingMessage.props.content, newTextContent]
            .filter(Boolean)
            .join('\n');

        const existingUsage = existingMessage.props.tokenUsage;
        const newUsage = event.totalUsage;

        const updatedMessage = await this.messageRepository.updateById(existingMessage._id, {
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
        return this.toDTO(updatedMessage);
    }

    private async createAssistantResponse(
        conversationId: string,
        event: AIChatFinishEvent,
        parts: AIMessageProps['parts'],
        textContent: string
    ): Promise<AIMessageDTO> {
        const now = new Date();
        const assistantMessage = await this.messageRepository.create({
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

        return this.toDTO(assistantMessage);
    }

    private toDTO(message: AIMessage): AIMessageDTO {
        return this.messageDTOMapper.toDTO(message);
    }
}

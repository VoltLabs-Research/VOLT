import { ErrorCodes } from '@core/constants/error-codes';
import type { AIConversationMessage } from '@modules/ai/domain/contracts/AIConversationMessage';
import type { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';
import type { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';
import { AIConversationMessageRole } from '@modules/ai/domain/contracts/AIConversationMessage';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import { AIMessageDTO } from '@modules/ai/application/dtos/ListAIConversationMessagesDTO';
import { SendAIConversationMessageInputDTO, SendAIConversationMessageOutputDTO } from '@modules/ai/application/dtos/SendAIConversationMessageDTO';
import AIResponseMessagePartsMapper from '@modules/ai/utilities/AIResponseMessagePartsMapper';
import AIUIMessageUtils from '@modules/ai/utilities/AIUIMessageUtils';
import AIMessageDTOMapper from '@modules/ai/utilities/AIMessageDTOMapper';
import AIMessage, { AIMessageRole } from '@modules/ai/domain/entities/AIMessage';
import type { AIChatFinishEvent, IAIChatTransport } from '@modules/ai/domain/port/IAIChatTransport';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

interface ConversationUpdatePayload {
    lastMessageAt: Date;
    lastProvider: string;
    lastModel: string;
    title: string;
};

interface TeamMemberLookupFilter extends Partial<TeamMemberProps> {
    team: string;
    user: string;
};

interface AIConversationLookup {
    _id: string;
    teamId: string;
    userId: string;
};

interface LastAssistantMessageFilter extends Partial<AIMessageProps> {
    conversationId: string;
    role: AIMessageRole;
};

@injectable()
export default class SendAIConversationMessageUseCase implements IUseCase<SendAIConversationMessageInputDTO, SendAIConversationMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository,

        @inject(AI_TOKENS.AIMessageRepository)
        private readonly messageRepository: IAIMessageRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(AI_TOKENS.AIChatTransport)
        private readonly aiChatTransport: IAIChatTransport,

        @inject(AI_TOKENS.AIMessageDTOMapper)
        private readonly messageDTOMapper: AIMessageDTOMapper,

        @inject(AI_TOKENS.AIUIMessageUtils)
        private readonly uiMessageUtils: AIUIMessageUtils,

        @inject(AI_TOKENS.AIResponseMessagePartsMapper)
        private readonly responseMessagePartsMapper: AIResponseMessagePartsMapper
    ) {}

    async execute(input: SendAIConversationMessageInputDTO): Promise<Result<SendAIConversationMessageOutputDTO, ApplicationError>> {
        const uiMessages = this.uiMessageUtils.normalizeUIMessages(input.messages);

        if (!uiMessages) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'UI messages are required'
            ));
        }

        const member = await this.teamMemberRepository.findOne({
            team: input.teamId,
            user: input.userId
        } satisfies TeamMemberLookupFilter);

        if (!member) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                'User is not a member of the selected team'
            ));
        }

        const conversation = await this.conversationRepository.findOne({
            _id: input.conversationId,
            teamId: input.teamId,
            userId: input.userId
        } as AIConversationLookup);

        if (!conversation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            ));
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

            return Result.ok({
                streamResult,
                userMessage: userMessage ? this.toDTO(userMessage) : undefined,
                assistantMessage
            });
        } catch (error) {
            rejectAssistantMessage(error);

            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
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
};

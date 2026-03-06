import { injectable, inject } from 'tsyringe';
import { convertToModelMessages } from 'ai';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import type { ITeamMemberRepository } from '@modules/team/domain/port/ITeamMemberRepository';
import AIMessage from '@modules/ai/domain/entities/AIMessage';
import AIChatOrchestratorService from '@modules/ai/application/services/AIChatOrchestratorService';
import {
    SendAIConversationMessageInputDTO,
    SendAIConversationMessageOutputDTO
} from '@modules/ai/application/dtos/SendAIConversationMessageDTO';
import { AIMessageDTO } from '@modules/ai/application/dtos/ListAIConversationMessagesDTO';
import AIResponseMessagePartsMapper from '@modules/ai/application/services/AIResponseMessagePartsMapper';
import AIUIMessageUtils from '@modules/ai/application/services/AIUIMessageUtils';
import AIMessageDTOMapper from '@modules/ai/application/services/AIMessageDTOMapper';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class SendAIConversationMessageUseCase implements IUseCase<SendAIConversationMessageInputDTO, SendAIConversationMessageOutputDTO, ApplicationError> {
    constructor(
        @inject(AI_TOKENS.AIConversationRepository)
        private readonly conversationRepository: IAIConversationRepository,

        @inject(AI_TOKENS.AIMessageRepository)
        private readonly messageRepository: IAIMessageRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(AI_TOKENS.AIChatOrchestratorService)
        private readonly aiChatOrchestrator: AIChatOrchestratorService,

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
        } as any);

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
        } as any);

        if (!conversation) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.AI_CONVERSATION_NOT_FOUND,
                'AI conversation not found'
            ));
        }

        const userText = input.message?.trim() || this.uiMessageUtils.extractLastUserMessageText(uiMessages);

        let userMessage: AIMessage | null = null;
        if (userText) {
            const now = new Date();
            userMessage = await this.messageRepository.create({
                conversationId: conversation.id,
                role: 'user',
                parts: [{ type: 'text', text: userText }],
                content: userText,
                modelInfo: null,
                tokenUsage: null,
                createdAt: now,
                updatedAt: now
            } as any);
        }

        const modelMessages = await convertToModelMessages(uiMessages);

        logger.debug(
            'AI conversation %s: %d UI messages -> %d model messages',
            conversation.id,
            uiMessages.length,
            modelMessages.length
        );

        try {
            const streamResult = await this.aiChatOrchestrator.generateReplyStream({
                teamId: input.teamId,
                userId: input.userId,
                provider: input.provider,
                model: input.model,
                messages: modelMessages,
                onFinish: async (event) => {
                    await this.persistAssistantResponse(conversation.id, event);
                    await this.conversationRepository.updateById(conversation.id, {
                        lastMessageAt: new Date(),
                        lastProvider: event.provider,
                        lastModel: event.model
                    } as any);
                }
            });

            return Result.ok({
                streamResult,
                userMessage: userMessage ? this.toDTO(userMessage) : undefined
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }

    private async persistAssistantResponse(
        conversationId: string,
        event: {
            text: string;
            totalUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null;
            finishReason: string;
            steps: any[];
            responseMessages: any[];
            provider: string;
            model: string;
        }
    ): Promise<void> {
        const { parts: allParts, textContent } = this.responseMessagePartsMapper.mapAssistantResponseParts(event.responseMessages);

        if (allParts.length === 0) return;

        const now = new Date();
        await this.messageRepository.create({
            conversationId,
            role: 'assistant',
            parts: allParts,
            content: textContent,
            modelInfo: {
                provider: event.provider,
                model: event.model,
                finishReason: event.finishReason,
                steps: event.steps.map((step) => ({
                    stepNumber: step.stepNumber,
                    toolCalls: step.toolCalls.map((toolCall: any) => ({
                        toolName: toolCall.toolName,
                        input: toolCall.args
                    })),
                    toolResults: step.toolResults.map((toolResult: any) => ({
                        toolName: toolResult.toolName,
                        input: toolResult.args,
                        output: toolResult.result
                    }))
                }))
            },
            tokenUsage: {
                inputTokens: event.totalUsage?.inputTokens ?? 0,
                outputTokens: event.totalUsage?.outputTokens ?? 0,
                totalTokens: event.totalUsage?.totalTokens ?? 0
            },
            createdAt: now,
            updatedAt: now
        } as any);
    }

    private toDTO(message: AIMessage): AIMessageDTO {
        return this.messageDTOMapper.toDTO(message);
    }
}

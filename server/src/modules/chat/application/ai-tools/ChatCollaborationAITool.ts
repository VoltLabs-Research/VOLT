import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { GetUserChatsUseCase } from '@modules/chat/application/use-cases/chat/GetUserChatsUseCase';
import { CreateGroupChatUseCase } from '@modules/chat/application/use-cases/chat/CreateGroupChatUseCase';
import { GetChatMessagesUseCase } from '@modules/chat/application/use-cases/chat-message/GetChatMessagesUseCase';
import { SendChatMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendChatMessageUseCase';
import { ChatMessageType } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['list', 'summarize', 'post', 'create']),
    chatId: z.string().optional(),
    text: z.string().optional(),
    memberIds: z.array(z.string()).optional(),
    name: z.string().optional()
});

type ChatCollaborationParams = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ChatCollaborationAITool extends AITool<ChatCollaborationParams> {
    readonly name = 'chat_collaboration';
    readonly description = 'Collaborate over team chats: list the user\'s chats, read a chat\'s messages to summarize it, post a text message to a chat, or create a new group chat. Use action to pick the operation.';
    readonly parameters = parameters;
    protected readonly needsApproval = (input: ChatCollaborationParams) => input.action === 'post' || input.action === 'create';

    constructor(
        protected readonly getUserChatsUseCase: GetUserChatsUseCase,
        protected readonly getChatMessagesUseCase: GetChatMessagesUseCase,
        protected readonly sendChatMessageUseCase: SendChatMessageUseCase,
        protected readonly createGroupChatUseCase: CreateGroupChatUseCase
    ) {
        super();
    }

    async execute(params: ChatCollaborationParams, scope: AIToolScope) {
        switch (params.action) {
            case 'list': {
                const value = await this.getUserChatsUseCase.execute({ userId: scope.userId });
                return { summary: `Found ${value.length} chats.`, data: value };
            }
            case 'summarize': {
                if (!params.chatId) throw new Error('chatId is required to summarize a chat.');
                const value = await this.getChatMessagesUseCase.execute({
                    userId: scope.userId,
                    chatId: params.chatId
                });
                return { summary: `Loaded ${value.data.length} messages from chat ${params.chatId}.`, data: value };
            }
            case 'post': {
                if (!params.chatId) throw new Error('chatId is required to post a message.');
                if (!params.text) throw new Error('text is required to post a message.');
                const value = await this.sendChatMessageUseCase.execute({
                    userId: scope.userId,
                    chatId: params.chatId,
                    content: params.text,
                    messageType: ChatMessageType.Text
                });
                return { summary: `Posted a message to chat ${params.chatId}.`, data: value };
            }
            case 'create': {
                if (!params.name) throw new Error('name is required to create a group chat.');
                const value = await this.createGroupChatUseCase.execute({
                    userId: scope.userId,
                    teamId: scope.teamId,
                    groupName: params.name,
                    participantIds: params.memberIds ?? []
                });
                return { summary: `Created group chat "${params.name}".`, data: value };
            }
        }
    }
}

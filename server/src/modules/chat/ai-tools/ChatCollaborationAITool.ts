import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ChatService from '@modules/chat/services/ChatService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['list', 'summarize', 'post', 'create']),
    chatId: z.string().optional(),
    text: z.string().optional(),
    memberIds: z.array(z.string()).optional(),
    name: z.string().optional()
});

type ChatCollaborationParams = z.infer<typeof parameters>;

export class ChatCollaborationAITool extends AITool<ChatCollaborationParams> {
    readonly name = 'chat_collaboration';
    readonly description = 'Collaborate over team chats: list the user\'s chats, read a chat\'s messages to summarize it, post a text message to a chat, or create a new group chat. Use action to pick the operation.';
    readonly parameters = parameters;
    protected readonly needsApproval = (input: ChatCollaborationParams) => input.action === 'post' || input.action === 'create';

    #service = new ChatService();

    async execute(params: ChatCollaborationParams, scope: AIToolScope) {
        switch (params.action) {
            case 'list': {
                const value = await this.#service.getUserChats(scope.userId);
                return { summary: `Found ${value.length} chats.`, data: value };
            }
            case 'summarize': {
                if (!params.chatId) throw new Error('chatId is required to summarize a chat.');
                const value = await this.#service.getChatMessages(scope.userId, params.chatId, {});
                return { summary: `Loaded ${value.data.length} messages from chat ${params.chatId}.`, data: value };
            }
            case 'post': {
                if (!params.chatId) throw new Error('chatId is required to post a message.');
                if (!params.text) throw new Error('text is required to post a message.');
                const value = await this.#service.sendChatMessage(scope.userId, params.chatId, {
                    content: params.text,
                    messageType: 'text'
                });
                return { summary: `Posted a message to chat ${params.chatId}.`, data: value };
            }
            case 'create': {
                if (!params.name) throw new Error('name is required to create a group chat.');
                const value = await this.#service.createGroupChat(scope.userId, {
                    teamId: scope.teamId,
                    groupName: params.name,
                    participantIds: params.memberIds ?? []
                });
                return { summary: `Created group chat "${params.name}".`, data: value };
            }
        }
    }
}

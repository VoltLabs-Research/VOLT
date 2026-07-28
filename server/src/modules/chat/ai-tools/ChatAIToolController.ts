import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ChatService from '@modules/chat/services/ChatService';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import {
    chatCollaborationSchema,
    type ChatCollaborationInput
} from '@volt/contracts/modules/chat/ai-tools';

export default class ChatAIToolController extends AIToolController {
    #service = new ChatService();

    @AITool({
        name: 'chat_collaboration',
        description: 'Collaborate over team chats: list the user\'s chats, read a chat\'s messages to summarize it, post a text message to a chat, or create a new group chat. Use action to pick the operation.',
        parameters: chatCollaborationSchema,
        needsApproval: (input) => input.action === 'post' || input.action === 'create'
    })
    async chatCollaboration(input: ChatCollaborationInput & AIToolScope) {
        switch (input.action) {
            case 'list': {
                const value = await this.#service.getUserChats(input.userId);
                return { summary: `Found ${value.length} chats.`, data: value };
            }
            case 'summarize': {
                if (!input.chatId) throw new Error('chatId is required to summarize a chat.');
                const value = await this.#service.getChatMessages(input.userId, input.chatId, {});
                return { summary: `Loaded ${value.data.length} messages from chat ${input.chatId}.`, data: value };
            }
            case 'post': {
                if (!input.chatId) throw new Error('chatId is required to post a message.');
                if (!input.text) throw new Error('text is required to post a message.');
                const value = await this.#service.sendChatMessage(input.userId, input.chatId, {
                    content: input.text,
                    messageType: ChatMessageType.Text
                });
                return { summary: `Posted a message to chat ${input.chatId}.`, data: value };
            }
            case 'create': {
                if (!input.name) throw new Error('name is required to create a group chat.');
                const value = await this.#service.createGroupChat(input.userId, {
                    teamId: input.teamId,
                    groupName: input.name,
                    participantIds: input.memberIds ?? []
                });
                return { summary: `Created group chat "${input.name}".`, data: value };
            }
        }
    }
}

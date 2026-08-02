import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import Chat from '@modules/chat/models/Chat';
import ChatMessage from '@modules/chat/models/ChatMessage';
import ChatService from '@modules/chat/services/ChatService';

@DefineEventGroup('chat')
export default class ChatEvents {
    #service = new ChatService();

    @Event('chat.deleted')
    async deleteChatMessages({ chatId }: EventMap['chat.deleted']) {
        await ChatMessage.delete({ chat: chatId });
    }

    @Event('user.deleted')
    async removeUserFromChats({ userId }: EventMap['user.deleted']) {
        await this.#service.removeUserFromAllChats(userId);
    }

    @Event('team.deleted')
    async deleteTeamChats({ teamId }: EventMap['team.deleted']) {
        await Chat.delete({ team: teamId });
    }
}

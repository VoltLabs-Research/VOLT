import { In } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';

@DefineEventGroup('ai')
export default class AiEvents{
    @Event('team.deleted')
    async deleteTeamConversations({ teamId }: EventMap['team.deleted']){
        await this.#deleteConversations({ teamId });
    }

    @Event('user.deleted')
    async deleteUserConversations({ userId }: EventMap['user.deleted']){
        await this.#deleteConversations({ userId });
    }

    async #deleteConversations(filter: FindOptionsWhere<AIConversation>): Promise<void>{
        const conversations = await AIConversation.find({
            where: filter,
            select: { id: true }
        });

        if(conversations.length === 0){
            return;
        }

        const conversationIds = conversations.map((conversation) => conversation.id);

        await AIMessage.delete({ conversationId: In(conversationIds) });

        await AIConversation.delete(filter);
    }
}

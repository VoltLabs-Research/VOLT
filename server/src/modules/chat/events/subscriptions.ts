import ChatModel from '@modules/chat/models/chat/ChatModel';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

const modelDeleteMany = {
    deleteMany: async (filter: Record<string, string>): Promise<number> => {
        const result = await ChatModel.deleteMany(filter);
        return result.deletedCount ?? 0;
    }
};

class ChatTeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    protected readonly repository = modelDeleteMany;
}

subscribeHandler('team.deleted', new ChatTeamDeletedEventHandler());

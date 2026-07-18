import ChatModel from '@modules/chat/models/chat/ChatModel';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

const modelDeleteMany = {
    deleteMany: async (filter: Record<string, string>): Promise<number> => {
        const result = await ChatModel.deleteMany(filter);
        return result.deletedCount ?? 0;
    }
};

@Subscribe('team.deleted')
export class ChatTeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    protected readonly repository = modelDeleteMany;
}

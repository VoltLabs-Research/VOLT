import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { AIConversationDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIConversationModel';
import AIConversation, { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';

class AIConversationMapper extends BaseMapper<AIConversation, AIConversationProps, AIConversationDocument> {
    constructor() {
        super(AIConversation, [
            'userId',
            'teamId'
        ]);
    }
};

export default new AIConversationMapper();

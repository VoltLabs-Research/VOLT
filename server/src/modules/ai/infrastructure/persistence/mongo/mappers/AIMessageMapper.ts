import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { AIMessageDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIMessageModel';
import AIMessage, { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';

class AIMessageMapper extends BaseMapper<AIMessage, AIMessageProps, AIMessageDocument> {
    constructor() {
        super(AIMessage, [
            'conversationId'
        ]);
    }
};

export default new AIMessageMapper();

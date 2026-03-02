import AIMessage, { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { AIMessageDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIMessageModel';

class AIMessageMapper extends BaseMapper<AIMessage, AIMessageProps, AIMessageDocument> {
    constructor() {
        super(AIMessage, [
            'conversationId'
        ]);
    }
}

export default new AIMessageMapper();

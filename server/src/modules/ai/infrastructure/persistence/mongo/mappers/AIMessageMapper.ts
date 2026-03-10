import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { AIMessageDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIMessageModel';
import AIMessage, { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';

export default createMongoMapper<AIMessage, AIMessageProps, AIMessageDocument>(AIMessage, [
    'conversationId'
]);

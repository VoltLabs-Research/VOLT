import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { AIMessageDocument } from '@modules/ai/models/AIMessageModel';
import AIMessage, { AIMessageProps } from '@modules/ai/entities/AIMessage';

export default createMongoMapper<AIMessage, AIMessageProps, AIMessageDocument>(AIMessage, [
    'conversationId'
]);

import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { AIConversationDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIConversationModel';
import AIConversation, { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';

export default createMongoMapper<AIConversation, AIConversationProps, AIConversationDocument>(AIConversation, [
    'userId',
    'teamId'
]);

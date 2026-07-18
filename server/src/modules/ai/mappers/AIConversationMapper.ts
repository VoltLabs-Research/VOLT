import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { AIConversationDocument } from '@modules/ai/models/AIConversationModel';
import AIConversation, { AIConversationProps } from '@modules/ai/entities/AIConversation';

export default createMongoMapper<AIConversation, AIConversationProps, AIConversationDocument>(AIConversation, [
    'userId',
    'teamId'
]);

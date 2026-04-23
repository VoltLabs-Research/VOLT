
import AIConversation, { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import aiConversationMapper from '@modules/ai/infrastructure/persistence/mongo/mappers/AIConversationMapper';
import AIConversationModel, { AIConversationDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIConversationModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

@Singleton()
export default class AIConversationRepository
    extends MongooseBaseRepository<AIConversation, AIConversationProps, AIConversationDocument>
    implements IAIConversationRepository {

    constructor() {
        super(AIConversationModel, aiConversationMapper);
    }
};

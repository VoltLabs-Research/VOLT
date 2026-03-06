import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import AIConversation, { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import AIConversationModel, { AIConversationDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIConversationModel';
import aiConversationMapper from '@modules/ai/infrastructure/persistence/mongo/mappers/AIConversationMapper';

@injectable()
export default class AIConversationRepository
    extends MongooseBaseRepository<AIConversation, AIConversationProps, AIConversationDocument>
    implements IAIConversationRepository {

    constructor() {
        super(AIConversationModel, aiConversationMapper);
    }
}

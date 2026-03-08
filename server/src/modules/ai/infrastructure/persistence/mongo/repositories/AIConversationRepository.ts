import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IAIConversationRepository } from '@modules/ai/domain/port/IAIConversationRepository';
import aiConversationMapper from '@modules/ai/infrastructure/persistence/mongo/mappers/AIConversationMapper';
import { AIConversationDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIConversationModel';
import AIConversation, { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import AIConversationModel from '@modules/ai/infrastructure/persistence/mongo/models/AIConversationModel';

@injectable()
export default class AIConversationRepository
    extends MongooseBaseRepository<AIConversation, AIConversationProps, AIConversationDocument>
    implements IAIConversationRepository {

    constructor() {
        super(AIConversationModel, aiConversationMapper);
    }
};

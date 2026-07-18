import { AI_TOKENS } from '@modules/ai/di/AITokens';

import AIConversation, { AIConversationProps } from '@modules/ai/entities/AIConversation';
import { IAIConversationRepository } from '@modules/ai/ports/IAIConversationRepository';
import aiConversationMapper from '@modules/ai/mappers/AIConversationMapper';
import AIConversationModel, { AIConversationDocument } from '@modules/ai/models/AIConversationModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

@Singleton(AI_TOKENS.AIConversationRepository)
export default class AIConversationRepository
    extends MongooseBaseRepository<AIConversation, AIConversationProps, AIConversationDocument>
    implements IAIConversationRepository {

    constructor() {
        super(AIConversationModel, aiConversationMapper);
    }

    findOwnedByUser(conversationId: string, teamId: string, userId: string): Promise<AIConversation | null> {
        return this.findOne({ _id: conversationId, teamId, userId });
    }
};

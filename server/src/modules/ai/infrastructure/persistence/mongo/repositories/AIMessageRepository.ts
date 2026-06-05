import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';

import AIMessage, { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';
import { IAIMessageRepository } from '@modules/ai/domain/port/IAIMessageRepository';
import aiMessageMapper from '@modules/ai/infrastructure/persistence/mongo/mappers/AIMessageMapper';
import AIMessageModel, { AIMessageDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIMessageModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

@Singleton(AI_TOKENS.AIMessageRepository)
export default class AIMessageRepository
    extends MongooseBaseRepository<AIMessage, AIMessageProps, AIMessageDocument>
    implements IAIMessageRepository {

    constructor() {
        super(AIMessageModel, aiMessageMapper);
    }
};

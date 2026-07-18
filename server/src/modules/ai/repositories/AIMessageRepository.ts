import { AI_TOKENS } from '@modules/ai/di/AITokens';

import AIMessage, { AIMessageProps } from '@modules/ai/entities/AIMessage';
import { IAIMessageRepository } from '@modules/ai/ports/IAIMessageRepository';
import aiMessageMapper from '@modules/ai/mappers/AIMessageMapper';
import AIMessageModel, { AIMessageDocument } from '@modules/ai/models/AIMessageModel';
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

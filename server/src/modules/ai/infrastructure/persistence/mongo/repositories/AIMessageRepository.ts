import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IAIMessageRepository } from '@modules/ai/domain/ports/IAIMessageRepository';
import AIMessage, { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';
import AIMessageModel, { AIMessageDocument } from '@modules/ai/infrastructure/persistence/mongo/models/AIMessageModel';
import aiMessageMapper from '@modules/ai/infrastructure/persistence/mongo/mappers/AIMessageMapper';

@injectable()
export default class AIMessageRepository
    extends MongooseBaseRepository<AIMessage, AIMessageProps, AIMessageDocument>
    implements IAIMessageRepository {

    constructor() {
        super(AIMessageModel, aiMessageMapper);
    }
}

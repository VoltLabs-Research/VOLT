import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import AIMessage, { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';

export interface IAIMessageRepository extends IBaseRepository<AIMessage, AIMessageProps> { }

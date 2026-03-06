import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import AIMessage, { AIMessageProps } from '@modules/ai/domain/entities/AIMessage';

export interface IAIMessageRepository extends IBaseRepository<AIMessage, AIMessageProps> { }

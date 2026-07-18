import AIMessage, { AIMessageProps } from '@modules/ai/entities/AIMessage';
import { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface IAIMessageRepository extends IBaseRepository<AIMessage, AIMessageProps> {}

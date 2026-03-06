import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import AIConversation, { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';

export interface IAIConversationRepository extends IBaseRepository<AIConversation, AIConversationProps> { }

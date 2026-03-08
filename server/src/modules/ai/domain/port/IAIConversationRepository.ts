import AIConversation, { AIConversationProps } from '@modules/ai/domain/entities/AIConversation';
import { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface IAIConversationRepository extends IBaseRepository<AIConversation, AIConversationProps> {}

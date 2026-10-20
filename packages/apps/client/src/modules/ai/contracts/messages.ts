import type { UIMessage } from 'ai';
import type { AIMessage } from '@volt/contracts/modules/ai/domain';

export interface AIConversationMessage extends Omit<AIMessage, 'parts'>{
    parts: UIMessage['parts'];
}

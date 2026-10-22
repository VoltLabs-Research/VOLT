import type { tags } from 'typia';

export interface CreateAIConversationInput{
    title?: string & tags.MaxLength<160>;
}

export interface UpdateAIConversationInput{
    title?: string & tags.MinLength<1> & tags.MaxLength<160>;
    isArchived?: boolean;
}

export interface ChatCollaborationInput{
    action: 'list' | 'summarize' | 'post' | 'create';
    chatId?: string;
    text?: string;
    memberIds?: string[];
    name?: string;
}

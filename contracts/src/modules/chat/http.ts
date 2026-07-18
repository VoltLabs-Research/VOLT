

import type { ChatMessageKind, ChatMessageMetadata } from './domain';

export interface CreateGroupChatInput{
    
    teamId: string;
    groupName: string;
    groupDescription?: string;
    participantIds: string[];
}

export interface AddUsersToGroupInput{
    userIds: string[];
}

export interface RemoveUsersFromGroupInput{
    userIds: string[];
}

export interface UpdateGroupInfoInput{
    groupName?: string;
    groupDescription?: string;
}

export type GroupAdminActionInput = 'add' | 'remove';

export interface UpdateGroupAdminsInput{
    action: GroupAdminActionInput;
    targetUserIds: string[];
}

export interface SendChatMessageInput{
    content: string;
    messageType: ChatMessageKind;
    metadata?: ChatMessageMetadata;
}

export interface EditMessageInput{
    content: string;
}

export interface ToggleMessageReactionInput{
    emoji: string;
}

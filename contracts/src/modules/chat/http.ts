// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId`/`:chatId`/`:targetUserId`/`:messageId`
// path params) is NOT here — the controller reads those from @Param/@CurrentUser
// and the service augments its own input.

import type { ChatMessageKind, ChatMessageMetadata } from './domain';

export interface CreateGroupChatInput{
    /** The group is created within this team (the client sends it in the body). */
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

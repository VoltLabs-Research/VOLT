export interface CreateGroupChatDTO {
    teamId: string;
    groupName: string;
    groupDescription?: string;
    participantIds: string[];
}

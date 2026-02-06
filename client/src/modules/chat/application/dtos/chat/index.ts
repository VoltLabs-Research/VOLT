export interface CreateGroupChatDTO {
    teamId: string;
    groupName: string;
    groupDescription?: string;
    participantIds: string[];
};

export interface UpdateGroupInfoDTO {
    groupName?: string;
    groupDescription?: string;
};

export interface UpdateGroupAdminsDTO {
    targetUserIds: string[];
    action: 'add' | 'remove';
};

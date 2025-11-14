export interface TeamInvitation {
    _id: string;
    team: {
        _id: string;
        name: string;
        description?: string;
        memberCount?: number;
    };
    invitedBy: {
        email: string;
    };
    email: string;
    token: string;
    role: 'Can view' | 'Can edit' | 'Full access';
    expiresAt: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
    updatedAt: string;
}

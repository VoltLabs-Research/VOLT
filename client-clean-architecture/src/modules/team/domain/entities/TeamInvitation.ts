export enum TeamInvitationStatus{
    Pending = 'pending',
    Accepted = 'accepted',
    Rejected = 'rejected'
};

export interface TeamInvitation{
    _id: string;
    team: any;
    invitedBy: any;
    invitedUser: any;
    email: string;
    token: string;
    role: string;
    expiresAt: Date;
    acceptedAt?: Date;
    status: TeamInvitationStatus;
    createdAt: Date;
    updatedAt: Date;
};

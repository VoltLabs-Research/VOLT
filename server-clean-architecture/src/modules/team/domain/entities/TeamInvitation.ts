export enum TeamInvitationRole{
    CanView = 'can-view',
    CanEdit = 'can-edit',
    FullAccess = 'full-access'
};

export enum TeamInvitationStatus{
    Pending = 'pending',
    Accepted = 'accepted',
    Rejected = 'rejected'
};

export interface TeamInvitationProps{
    team: string;
    invitedBy: string;
    invitedUser: string;
    email: string;
    token: string;
    role: TeamInvitationRole;
    expiresAt: Date;
    acceptedAt: Date;
    status: TeamInvitationStatus;
};

export default class TeamInvitation{
    constructor(
        public id: string,
        public props: TeamInvitationProps
    ){}

    public isExpired(): boolean{
        const now = new Date();
        return now > this.props.expiresAt;
    }
};
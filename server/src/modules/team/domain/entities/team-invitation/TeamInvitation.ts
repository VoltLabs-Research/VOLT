export interface TeamInvitationRef {
    _id?: string;
    toString?: () => string;
};

export interface TeamInvitationProps{
    team: string;
    invitedBy: string;
    invitedUser: string;
    email: string;
    token: string;
    role: string;
    expiresAt: Date;
    acceptedAt?: Date;
    status: TeamInvitationStatus;
};

export enum TeamInvitationStatus{
    Pending = 'pending',
    Accepted = 'accepted',
    Rejected = 'rejected'
};

export default class TeamInvitation{
    constructor(
        public _id: string,
        public props: TeamInvitationProps
    ){}

    public get id(): string {
        return this._id;
    }

    public isExpired(): boolean{
        const now = new Date();
        return now > this.props.expiresAt;
    }

    public isPending(): boolean {
        return this.props.status === TeamInvitationStatus.Pending;
    }

    public getTeamId(): string {
        return TeamInvitation.getRefId(this.props.team);
    }

    public getInvitedUserId(): string {
        return TeamInvitation.getRefId(this.props.invitedUser);
    }

    public getRoleId(): string {
        return TeamInvitation.getRefId(this.props.role);
    }

    public accept(acceptedAt: Date = new Date()): Partial<TeamInvitationProps> {
        this.props.status = TeamInvitationStatus.Accepted;
        this.props.acceptedAt = acceptedAt;

        return {
            status: this.props.status,
            acceptedAt: this.props.acceptedAt
        };
    }

    public reject(): Partial<TeamInvitationProps> {
        this.props.status = TeamInvitationStatus.Rejected;

        return {
            status: this.props.status
        };
    }

    public static normalizeEmail(email: string): string {
        return email.trim().toLowerCase();
    }

    private static getRefId(value: string | TeamInvitationRef): string {
        if (typeof value === 'string') {
            return value;
        }

        if (value._id) {
            return value._id;
        }

        return value.toString?.() ?? '';
    }
};

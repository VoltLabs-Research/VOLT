export interface TeamOwnerRef {
    _id?: string;
    toString?: () => string;
};

export interface TeamProps {
    name: string;
    description: string;
    owner: string | TeamOwnerRef;
    admins?: string[];
    members?: string[];
    invitations?: string[];
    containers?: string[];
    trajectories?: string[];
    chats?: string[];
    plugins?: string[];
    createdAt: Date;
    updatedAt: Date;
};

export default class Team {
    constructor(
        public readonly _id: string,
        public props: TeamProps
    ){}

    public get id(): string {
        return this._id;
    }

    public getOwnerId(): string {
        if (typeof this.props.owner === 'string') {
            return this.props.owner;
        }

        if (this.props.owner._id) {
            return this.props.owner._id;
        }

        return this.props.owner.toString?.() ?? '';
    }
};

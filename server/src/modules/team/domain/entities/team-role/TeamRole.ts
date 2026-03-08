export interface TeamRoleProps{
    team: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export default class TeamRole{
    constructor(
        public _id: string,
        public props: TeamRoleProps
    ){}

    public get id(): string {
        return this._id;
    }

    public canRenameTo(name?: string): boolean {
        if (!name) {
            return true;
        }

        if (!this.props.isSystem) {
            return true;
        }

        return name === this.props.name;
    }

    public getUpdatePayload(input: Partial<Pick<TeamRoleProps, 'name' | 'permissions'>>): Partial<TeamRoleProps> {
        if (this.props.isSystem) {
            return {
                permissions: input.permissions
            };
        }

        return {
            name: input.name,
            permissions: input.permissions
        };
    }

    public static create(input: {
        teamId: string;
        name: string;
        permissions: string[];
        isSystem: boolean;
        now?: Date;
    }): Partial<TeamRoleProps> {
        const now = input.now ?? new Date();

        return {
            team: input.teamId,
            name: input.name,
            permissions: [...new Set(input.permissions)],
            isSystem: input.isSystem,
            createdAt: now,
            updatedAt: now
        };
    }
};

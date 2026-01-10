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
        public id: string,
        public props: TeamRoleProps
    ){}
};
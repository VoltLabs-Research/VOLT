export interface TeamProps {
    name: string;
    description: string;
    owner: any;
    createdAt: Date;
    updatedAt: Date;
};

export default class Team {
    constructor(
        public readonly id: string,
        public props: TeamProps
    ){}
};
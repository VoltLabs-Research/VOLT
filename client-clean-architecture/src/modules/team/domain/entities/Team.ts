export interface TeamUser {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
}

export interface Team {
    _id: string;
    name: string;
    description?: string;
    owner: TeamUser | string;
    members: (TeamUser | string)[];
    trajectories: (Record<string, any> | string)[];
    createdAt: string;
    updatedAt: string;
}

import User from "../../domain/entities/User";

export interface UpdateAccountInputDTO{
    id: string;
    firstName?: string;
    lastName?: string;
    avatar?: any;
};

export interface UpdateAccountOutputDTO{
    user: User
};
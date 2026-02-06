import User from '@modules/auth/domain/entities/User';

export interface UpdateAccountInputDTO{
    userId: string;
    firstName?: string;
    lastName?: string;
    avatar?: any;
};

export interface UpdateAccountOutputDTO{
    user: User
};
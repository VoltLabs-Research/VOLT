import type { UserProps } from '@modules/auth/domain/entities/User';

export interface UpdateAccountInputDTO{
    userId: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    avatar?: any;
    file?: Express.Multer.File;
};

export type UpdateAccountOutputDTO = {
    _id: string;
    fullName: string;
} & UserProps;
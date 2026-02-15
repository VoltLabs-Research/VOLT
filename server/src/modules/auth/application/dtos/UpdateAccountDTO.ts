import { UserProps } from '@modules/auth/domain/entities/User';
import { Multer } from 'multer';

export interface UpdateAccountInputDTO{
    userId: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    avatar?: any;
    file?: Multer.File;
};

export type UpdateAccountOutputDTO = {
    _id: string;
    fullName: string;
} & UserProps;
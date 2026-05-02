import type { PersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';

export interface UpdateAccountInputDTO{
    userId: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    file?: Express.Multer.File;
}

export type UpdateAccountOutputDTO = {
    fullName: string;
} & PersistedUserDTO;

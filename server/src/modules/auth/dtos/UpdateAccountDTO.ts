import type { PersistedUserDTO } from '@modules/auth/dtos/PersistedUserDTO';
import type { UpdateAccountInput } from '@volt/contracts/modules/auth/http';

export interface UpdateAccountInputDTO extends UpdateAccountInput{
    userId: string;
    file?: Express.Multer.File;
}

export type UpdateAccountOutputDTO = {
    fullName: string;
} & PersistedUserDTO;

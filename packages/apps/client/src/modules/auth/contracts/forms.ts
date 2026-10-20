import type { UpdateAccountInput } from '@volt/contracts/modules/auth/http';

export interface CheckEmailParams{
    email: string;
}

export interface UpdateAvatarInput{
    avatar: File;
}

export type UpdateMeInput = UpdateAccountInput | UpdateAvatarInput;

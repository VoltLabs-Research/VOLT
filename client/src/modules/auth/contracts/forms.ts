import type { SignUpInput, UpdateAccountInput } from '@volt/contracts/modules/auth/http';

export interface SignUpFormInput extends SignUpInput{
    passwordConfirm: string;
}

export interface CheckEmailParams{
    email: string;
}

export interface UpdateAvatarInput{
    avatar: File;
}

export type UpdateMeInput = UpdateAccountInput | UpdateAvatarInput;

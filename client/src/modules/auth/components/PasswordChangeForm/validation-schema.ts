import type { GetPasswordInfoOutputDTO } from '@/modules/auth/api/service';

export type PasswordInfo = GetPasswordInfoOutputDTO;

export interface PasswordChangeForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

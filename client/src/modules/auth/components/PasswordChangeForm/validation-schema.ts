import { z } from 'zod';
import type { GetPasswordInfoOutputDTO } from '@/modules/auth/api/dtos/password-info';

export type PasswordInfo = GetPasswordInfoOutputDTO;

export interface PasswordChangeForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export const passwordChangeSchema = z.object({
    currentPassword: z.string(),
    newPassword: z
        .string()
        .min(1, 'New password is required')
        .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z
        .string()
        .min(1, 'Password confirmation is required')
}).refine((data) => data.confirmPassword === data.newPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
});

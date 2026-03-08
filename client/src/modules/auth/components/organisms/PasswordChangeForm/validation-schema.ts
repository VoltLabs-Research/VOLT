import { z } from 'zod';

export type { GetPasswordInfoOutputDTO as PasswordInfo } from '@/modules/auth/api/dtos/password-info';

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

export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

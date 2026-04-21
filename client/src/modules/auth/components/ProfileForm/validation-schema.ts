import { z } from 'zod';

export interface ProfileForm {
    fullName: string;
    email: string;
};

export const profileSchema = z.object({
    fullName: z
        .string()
        .min(1, 'Full name is required'),
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email')
});

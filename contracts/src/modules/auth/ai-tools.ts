import { z } from 'zod';

export const updateProfileSchema = z.object({
    fullName: z.string().optional(),
    email: z.string().optional()
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

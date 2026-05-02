import { z } from 'zod';

export interface JoinTeamForm {
    code: string;
}

export const joinTeamSchema = z.object({
    code: z.string()
        .length(5, 'Code must be exactly 5 characters')
        .regex(/^[A-Za-z0-9]{5}$/, 'Code must be alphanumeric')
        .transform((value) => value.toUpperCase())
}).strict();

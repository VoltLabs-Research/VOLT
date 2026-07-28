import { z } from 'zod';

export const getTeamContextSchema = z.object({});

export type GetTeamContextInput = z.infer<typeof getTeamContextSchema>;

import { z } from 'zod';

export const getActivitySummarySchema = z.object({
    range: z.number().int().positive().max(365).optional().describe('Days to look back. Defaults to 7.'),
    scope: z.enum(['team', 'self']).optional().describe('"team" (default) summarizes all members; "self" only the current user.')
});

export type GetActivitySummaryInput = z.infer<typeof getActivitySummarySchema>;

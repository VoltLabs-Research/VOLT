import { z } from 'zod';

export const getDashboardMetricsSchema = z.object({});

export const globalSearchSchema = z.object({
    query: z.string().optional().describe('Free-text search term (at least 2 characters to match anything).'),
    limit: z.number().optional().describe('Max results per entity type (1-10, default 5).')
});

export type GetDashboardMetricsInput = z.infer<typeof getDashboardMetricsSchema>;
export type GlobalSearchInput = z.infer<typeof globalSearchSchema>;

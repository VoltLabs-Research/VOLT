import { z } from 'zod';

export const analysisRefSchema = z.object({ analysisId: z.string() });

export const listAnalysesSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50),
    search: z.string().optional()
});

export const listTrajectoryAnalysesSchema = z.object({
    trajectoryId: z.string(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50)
});

export const listAnalysesByConfigSchema = z.object({
    trajectoryId: z.string(),
    configFilter: z.record(z.string(), z.unknown()).optional(),
    status: z.string().optional()
});

export const getAnalysisFrameLogSchema = z.object({
    analysisId: z.string(),
    timestep: z.number(),
    afterCursor: z.string().optional()
});

export const compareAnalysesSchema = z.object({
    analysisIdA: z.string(),
    analysisIdB: z.string()
});

export const deleteAnalysisSchema = z.object({
    analysisId: z.string(),
    reason: z.string().optional()
});

export type AnalysisRefInput = z.infer<typeof analysisRefSchema>;
export type ListAnalysesInput = z.infer<typeof listAnalysesSchema>;
export type ListTrajectoryAnalysesInput = z.infer<typeof listTrajectoryAnalysesSchema>;
export type ListAnalysesByConfigInput = z.infer<typeof listAnalysesByConfigSchema>;
export type GetAnalysisFrameLogInput = z.infer<typeof getAnalysisFrameLogSchema>;
export type CompareAnalysesInput = z.infer<typeof compareAnalysesSchema>;
export type DeleteAnalysisInput = z.infer<typeof deleteAnalysisSchema>;

import { z } from 'zod';

export const listTrajectoriesSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(20),
    folderId: z.string().optional(),
    search: z.string().optional()
});

export const listPublicTrajectoriesSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(20),
    search: z.string().optional()
});

export const listSampleSimulationsSchema = z.object({});

export const getTrajectorySchema = z.object({ trajectoryId: z.string() });

export const getTrajectoryTeamMetricsSchema = z.object({});

export const updateTrajectorySchema = z.object({
    trajectoryId: z.string(),
    name: z.string(),
    isPublic: z.boolean()
});

export const cloneTrajectorySchema = z.object({
    sourceTrajectoryId: z.string(),
    targetClusterId: z.string().optional()
});

export const moveTrajectorySchema = z.object({
    trajectoryId: z.string(),
    folderId: z.string().nullable()
});

export const deleteTrajectorySchema = z.object({
    trajectoryId: z.string(),
    reason: z.string().optional()
});

export const deleteTrajectoryFolderSchema = z.object({
    folderId: z.string(),
    reason: z.string().optional()
});

export type ListTrajectoriesInput = z.infer<typeof listTrajectoriesSchema>;
export type ListPublicTrajectoriesInput = z.infer<typeof listPublicTrajectoriesSchema>;
export type ListSampleSimulationsInput = z.infer<typeof listSampleSimulationsSchema>;
export type GetTrajectoryInput = z.infer<typeof getTrajectorySchema>;
export type GetTrajectoryTeamMetricsInput = z.infer<typeof getTrajectoryTeamMetricsSchema>;
export type UpdateTrajectoryInput = z.infer<typeof updateTrajectorySchema>;
export type CloneTrajectoryInput = z.infer<typeof cloneTrajectorySchema>;
export type MoveTrajectoryInput = z.infer<typeof moveTrajectorySchema>;
export type DeleteTrajectoryInput = z.infer<typeof deleteTrajectorySchema>;
export type DeleteTrajectoryFolderInput = z.infer<typeof deleteTrajectoryFolderSchema>;

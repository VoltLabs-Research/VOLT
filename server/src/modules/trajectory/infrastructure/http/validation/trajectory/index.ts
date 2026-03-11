import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createPaginationLimitSchema, createPaginationQuerySchema, createTeamScopedParamsSchema, objectIdSchema, paginationPageSchema, teamParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';

import { z } from 'zod/v4';

const trajectoryAnalysisIdSchema = z.union([objectIdSchema, z.literal('default')]);

const paginationQuerySchema = createPaginationQuerySchema({
    maxLimit: 100000,
    includeSearch: true
});

const trajectoryParamsSchema = createTeamScopedParamsSchema('trajectoryId');
const folderParamsSchema = createTeamScopedParamsSchema('folderId');

const trajectoryAnalysisParamsSchema = trajectoryParamsSchema.extend({
    analysisId: trajectoryAnalysisIdSchema
}).strict();

const trajectoryGlbParamsSchema = trajectoryParamsSchema.extend({
    timestep: z.string().trim().min(1),
    analysisId: trajectoryAnalysisIdSchema
}).strict();

const getAtomsQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    exposureId: objectIdSchema.optional(),
    page: paginationPageSchema,
    limit: createPaginationLimitSchema(100000)
}).strict();

const getSceneArtifactsQuerySchema = z.object({
    analysisId: trajectoryAnalysisIdSchema.optional(),
    sourceType: z.enum(['color-coding', 'particle-filter', 'plugin-exposure']).optional(),
    type: z.enum(['color-coding', 'particle-filter', 'plugin-exposure']).optional(),
    projection: z.enum(['raw', 'renderable-exposures']).optional(),
    timestep: z.coerce.number().int().min(0).optional(),
    page: paginationPageSchema,
    limit: createPaginationLimitSchema(100000)
}).strict();

const updateTrajectorySchema = z.object({
    name: z.string().min(1).optional(),
    isPublic: z.boolean().optional()
}).strict();

const createFolderSchema = z.object({
    title: z.string().trim().min(1).max(255),
    parentId: objectIdSchema.nullable().optional()
}).strict();

const updateFolderSchema = z.object({
    title: z.string().trim().min(1).max(255)
}).strict();

const moveTrajectorySchema = z.object({
    folderId: objectIdSchema.nullable()
}).strict();

export const trajectoryValidation = createResourceValidation({
    listByTeamId: {
        params: teamParamsSchema,
        query: paginationQuerySchema.extend({
            folderId: z.string().optional()
        })
    },
    createFolder: {
        params: teamParamsSchema,
        body: createFolderSchema
    },
    listFolders: {
        params: teamParamsSchema,
        query: createPaginationQuerySchema({ maxLimit: 500 }).extend({
            parentId: z.string().optional()
        })
    },
    getFolder: {
        params: folderParamsSchema
    },
    updateFolder: {
        params: folderParamsSchema,
        body: updateFolderSchema
    },
    deleteFolder: {
        params: folderParamsSchema
    },
    getMetrics: {
        params: teamParamsSchema
    },
    getPreview: {
        params: trajectoryParamsSchema
    },
    downloadTrajectory: {
        params: trajectoryParamsSchema
    },
    getAtoms: {
        params: trajectoryParamsSchema,
        query: getAtomsQuerySchema
    },
    getAtomsByAnalysis: {
        params: trajectoryAnalysisParamsSchema,
        query: getAtomsQuerySchema
    },
    getSceneArtifacts: {
        params: trajectoryParamsSchema,
        query: getSceneArtifactsQuerySchema
    },
    getGLB: {
        params: trajectoryGlbParamsSchema
    },
    getById: {
        params: trajectoryParamsSchema
    },
    update: {
        params: trajectoryParamsSchema,
        body: updateTrajectorySchema
    },
    move: {
        params: trajectoryParamsSchema,
        body: moveTrajectorySchema
    }
});

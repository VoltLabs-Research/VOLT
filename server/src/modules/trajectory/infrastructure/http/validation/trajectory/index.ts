import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createPaginationLimitSchema, createPaginationQuerySchema, createTeamScopedParamsSchema, objectIdSchema, paginationPageSchema, teamParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';

import { z } from 'zod/v4';

const trajectoryAnalysisIdSchema = z.union([objectIdSchema, z.literal('default')]);

const paginationQuerySchema = createPaginationQuerySchema({
    maxLimit: 100000,
    includeSearch: true
});

const trajectoryParamsSchema = createTeamScopedParamsSchema('trajectoryId');

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

export const trajectoryValidation = createResourceValidation({
    listByTeamId: {
        params: teamParamsSchema,
        query: paginationQuerySchema
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
    }
});

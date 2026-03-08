import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { createTeamScopedParamsSchema, objectIdSchema } from '@shared/infrastructure/http/validation/shared-schemas';

import { z } from 'zod/v4';

const analysisIdSchema = z.union([objectIdSchema, z.literal('default')]);

const colorCodingParamsSchema = createTeamScopedParamsSchema('trajectoryId');

const colorCodingAnalysisParamsSchema = colorCodingParamsSchema.extend({
    analysisId: analysisIdSchema
}).strict();

const colorCodingPropertiesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    exposureId: objectIdSchema.optional()
}).strict();

const colorCodingStatsQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    type: z.string().trim().min(1),
    exposureId: objectIdSchema.optional()
}).strict();

const colorCodingModelQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    exposureId: objectIdSchema.optional(),
    startValue: z.coerce.number().finite(),
    endValue: z.coerce.number().finite(),
    gradient: z.string().trim().min(1)
}).strict();

const applyColorCodingBodySchema = z.object({
    timestep: z.string().min(1),
    property: z.string().min(1),
    startValue: z.number(),
    endValue: z.number(),
    gradient: z.string().min(1),
    exposureId: objectIdSchema.optional()
}).strict();

export const colorCodingValidation = {
    getProperties: createValidationMiddleware({
        params: colorCodingParamsSchema,
        query: colorCodingPropertiesQuerySchema
    }),
    getPropertiesByAnalysis: createValidationMiddleware({
        params: colorCodingAnalysisParamsSchema,
        query: colorCodingPropertiesQuerySchema
    }),
    getStats: createValidationMiddleware({
        params: colorCodingParamsSchema,
        query: colorCodingStatsQuerySchema
    }),
    getStatsByAnalysis: createValidationMiddleware({
        params: colorCodingAnalysisParamsSchema,
        query: colorCodingStatsQuerySchema
    }),
    getModel: createValidationMiddleware({
        params: colorCodingParamsSchema,
        query: colorCodingModelQuerySchema
    }),
    getModelByAnalysis: createValidationMiddleware({
        params: colorCodingAnalysisParamsSchema,
        query: colorCodingModelQuerySchema
    }),
    applyColorCoding: createValidationMiddleware({
        params: colorCodingParamsSchema,
        body: applyColorCodingBodySchema
    }),
    applyColorCodingByAnalysis: createValidationMiddleware({
        params: colorCodingAnalysisParamsSchema,
        body: applyColorCodingBodySchema
    })
};

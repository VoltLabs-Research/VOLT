import { z } from 'zod/v4';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import {
    createTeamScopedParamsSchema,
    objectIdSchema
} from '@shared/infrastructure/http/validation/shared-schemas';

const analysisIdSchema = z.union([objectIdSchema, z.literal('default')]);

const particleFilterParamsSchema = createTeamScopedParamsSchema('trajectoryId');

const particleFilterAnalysisParamsSchema = particleFilterParamsSchema.extend({
    analysisId: analysisIdSchema
}).strict();

const particleFilterPropertiesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    exposureId: objectIdSchema.optional()
}).strict();

const particleFilterPreviewQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    operator: z.enum(['==', '!=', '>', '>=', '<', '<=']),
    value: z.coerce.number().finite(),
    exposureId: objectIdSchema.optional()
}).strict();

const particleFilterUniqueValuesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    exposureId: objectIdSchema.optional(),
    maxValues: z.coerce.number().int().min(1).optional()
}).strict();

const particleFilterModelQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    operator: z.enum(['==', '!=', '>', '>=', '<', '<=']),
    value: z.union([z.coerce.number().finite(), z.string().trim().min(1)]),
    action: z.enum(['delete', 'highlight']).optional(),
    exposureId: objectIdSchema.optional()
}).strict();

const applyFilterBodySchema = z.object({
    timestep: z.string().min(1),
    action: z.enum(['delete', 'highlight']),
    property: z.string().min(1),
    operator: z.enum(['==', '!=', '>', '>=', '<', '<=']),
    value: z.number(),
    exposureId: objectIdSchema.optional()
}).strict();

export const particleFilterValidation = {
    getProperties: createValidationMiddleware({
        params: particleFilterParamsSchema,
        query: particleFilterPropertiesQuerySchema
    }),
    getPropertiesByAnalysis: createValidationMiddleware({
        params: particleFilterAnalysisParamsSchema,
        query: particleFilterPropertiesQuerySchema
    }),
    preview: createValidationMiddleware({
        params: particleFilterParamsSchema,
        query: particleFilterPreviewQuerySchema
    }),
    previewByAnalysis: createValidationMiddleware({
        params: particleFilterAnalysisParamsSchema,
        query: particleFilterPreviewQuerySchema
    }),
    getUniqueValues: createValidationMiddleware({
        params: particleFilterParamsSchema,
        query: particleFilterUniqueValuesQuerySchema
    }),
    getUniqueValuesByAnalysis: createValidationMiddleware({
        params: particleFilterAnalysisParamsSchema,
        query: particleFilterUniqueValuesQuerySchema
    }),
    getModel: createValidationMiddleware({
        params: particleFilterParamsSchema,
        query: particleFilterModelQuerySchema
    }),
    getModelByAnalysis: createValidationMiddleware({
        params: particleFilterAnalysisParamsSchema,
        query: particleFilterModelQuerySchema
    }),
    applyFilter: createValidationMiddleware({
        params: particleFilterParamsSchema,
        body: applyFilterBodySchema
    }),
    applyFilterByAnalysis: createValidationMiddleware({
        params: particleFilterAnalysisParamsSchema,
        body: applyFilterBodySchema
    })
};

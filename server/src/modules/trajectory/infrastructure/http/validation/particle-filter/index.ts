import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createTeamScopedParamsSchema, objectIdSchema } from '@shared/infrastructure/http/validation/shared-schemas';

import { z } from 'zod/v4';

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

export const particleFilterValidation = createResourceValidation({
    getProperties: {
        params: particleFilterParamsSchema,
        query: particleFilterPropertiesQuerySchema
    },
    getPropertiesByAnalysis: {
        params: particleFilterAnalysisParamsSchema,
        query: particleFilterPropertiesQuerySchema
    },
    preview: {
        params: particleFilterParamsSchema,
        query: particleFilterPreviewQuerySchema
    },
    previewByAnalysis: {
        params: particleFilterAnalysisParamsSchema,
        query: particleFilterPreviewQuerySchema
    },
    getUniqueValues: {
        params: particleFilterParamsSchema,
        query: particleFilterUniqueValuesQuerySchema
    },
    getUniqueValuesByAnalysis: {
        params: particleFilterAnalysisParamsSchema,
        query: particleFilterUniqueValuesQuerySchema
    },
    getModel: {
        params: particleFilterParamsSchema,
        query: particleFilterModelQuerySchema
    },
    getModelByAnalysis: {
        params: particleFilterAnalysisParamsSchema,
        query: particleFilterModelQuerySchema
    },
    applyFilter: {
        params: particleFilterParamsSchema,
        body: applyFilterBodySchema
    },
    applyFilterByAnalysis: {
        params: particleFilterAnalysisParamsSchema,
        body: applyFilterBodySchema
    }
});

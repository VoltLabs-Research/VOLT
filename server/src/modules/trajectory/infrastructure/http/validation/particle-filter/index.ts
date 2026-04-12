import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createTeamScopedParamsSchema, objectIdSchema } from '@shared/infrastructure/http/validation/shared-schemas';

import { z } from 'zod/v4';

const analysisIdSchema = z.union([objectIdSchema, z.literal('default')]);
const exposureIdSchema = z.string().trim().min(1);
const particleFilterOperatorSchema = z.enum(['==', '!=', '>', '>=', '<', '<=']);
const particleFilterCombinatorSchema = z.enum(['AND', 'OR']);
const particleFilterConditionSchema = z.object({
    kind: z.literal('property').optional(),
    property: z.string().trim().min(1),
    operator: particleFilterOperatorSchema,
    value: z.coerce.number().finite(),
    exposureId: exposureIdSchema.optional()
}).strict();

const parseConditionsQuerySchema = z.string().transform((value, context) => {
    try {
        return particleFilterConditionSchema.array().min(1).parse(JSON.parse(value));
    } catch {
        context.addIssue({
            code: 'custom',
            message: 'conditions must be a JSON-encoded array of particle-filter conditions'
        });

        return z.NEVER;
    }
});

const particleFilterParamsSchema = createTeamScopedParamsSchema('trajectoryId');

const particleFilterAnalysisParamsSchema = particleFilterParamsSchema.extend({
    analysisId: analysisIdSchema
}).strict();

const particleFilterPropertiesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    exposureId: exposureIdSchema.optional()
}).strict();

const particleFilterLegacyExpressionQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    operator: particleFilterOperatorSchema,
    value: z.coerce.number().finite(),
    exposureId: exposureIdSchema.optional()
}).strict();

const particleFilterCompositeExpressionQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    combinator: particleFilterCombinatorSchema,
    conditions: parseConditionsQuerySchema
}).strict();

const particleFilterPreviewQuerySchema = z.union([
    particleFilterLegacyExpressionQuerySchema,
    particleFilterCompositeExpressionQuerySchema
]);

const particleFilterUniqueValuesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    exposureId: exposureIdSchema.optional(),
    maxValues: z.coerce.number().int().min(1).optional()
}).strict();

const particleFilterLegacyModelQuerySchema = particleFilterLegacyExpressionQuerySchema.extend({
    action: z.enum(['delete', 'highlight']).optional()
}).strict();

const particleFilterCompositeModelQuerySchema = particleFilterCompositeExpressionQuerySchema.extend({
    action: z.enum(['delete', 'highlight']).optional()
}).strict();

const particleFilterModelQuerySchema = z.union([
    particleFilterLegacyModelQuerySchema,
    particleFilterCompositeModelQuerySchema
]);

const applyLegacyFilterBodySchema = z.object({
    timestep: z.string().min(1),
    action: z.enum(['delete', 'highlight']),
    property: z.string().min(1),
    operator: particleFilterOperatorSchema,
    value: z.coerce.number().finite(),
    exposureId: exposureIdSchema.optional()
}).strict();

const applyCompositeFilterBodySchema = z.object({
    timestep: z.string().min(1),
    action: z.enum(['delete', 'highlight']),
    combinator: particleFilterCombinatorSchema,
    conditions: particleFilterConditionSchema.array().min(1)
}).strict();

const applyFilterBodySchema = z.union([
    applyLegacyFilterBodySchema,
    applyCompositeFilterBodySchema
]);

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

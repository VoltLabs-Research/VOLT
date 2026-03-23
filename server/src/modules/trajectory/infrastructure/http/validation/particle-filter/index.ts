import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createTeamScopedParamsSchema, objectIdSchema } from '@shared/infrastructure/http/validation/shared-schemas';

import { z } from 'zod/v4';

const analysisIdSchema = z.union([objectIdSchema, z.literal('default')]);
const exposureIdSchema = z.string().trim().min(1);
const particleFilterOperatorSchema = z.enum(['==', '!=', '>', '>=', '<', '<=']);
const particleFilterCombinatorSchema = z.enum(['AND', 'OR']);
const particleFilterModeSchema = z.literal('preset');
const particleFilterPresetSchema = z.literal('surface-atoms');
const surfaceAtomsCutoffModeSchema = z.enum(['auto', 'manual']);
const particleFilterPropertyConditionSchema = z.object({
    kind: z.literal('property'),
    property: z.string().trim().min(1),
    operator: particleFilterOperatorSchema,
    value: z.coerce.number().finite(),
    exposureId: exposureIdSchema.optional()
}).strict();
const surfaceAtomsPresetConfigSchema = z.object({
    layers: z.coerce.number().int().min(1).default(10),
    cutoffMode: surfaceAtomsCutoffModeSchema.default('auto'),
    cutoffRadius: z.coerce.number().positive().optional(),
    coordinationDeficit: z.coerce.number().int().min(1).default(2),
    anisotropyThreshold: z.coerce.number().min(0).max(1).default(0.35),
    byType: z.coerce.boolean().default(true)
}).strict().superRefine((value, context) => {
    if (value.cutoffMode === 'manual' && value.cutoffRadius === undefined) {
        context.addIssue({
            code: 'custom',
            message: 'cutoffRadius is required when cutoffMode is manual',
            path: ['cutoffRadius']
        });
    }
});

const particleFilterPresetConditionSchema = z.object({
    kind: z.literal('preset'),
    preset: particleFilterPresetSchema,
    presetConfig: surfaceAtomsPresetConfigSchema
}).strict();

const particleFilterConditionSchema = z.union([
    particleFilterPropertyConditionSchema,
    particleFilterPresetConditionSchema,
    particleFilterPropertyConditionSchema.omit({ kind: true })
]);

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

const parsePresetConfigQuerySchema = z.string().transform((value, context) => {
    try {
        return surfaceAtomsPresetConfigSchema.parse(JSON.parse(value));
    } catch {
        context.addIssue({
            code: 'custom',
            message: 'presetConfig must be a JSON-encoded particle-filter preset config'
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

const particleFilterPresetExpressionQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    mode: particleFilterModeSchema,
    preset: particleFilterPresetSchema,
    presetConfig: parsePresetConfigQuerySchema
}).strict();

const particleFilterPreviewQuerySchema = z.union([
    particleFilterLegacyExpressionQuerySchema,
    particleFilterCompositeExpressionQuerySchema,
    particleFilterPresetExpressionQuerySchema
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

const particleFilterPresetModelQuerySchema = particleFilterPresetExpressionQuerySchema.extend({
    action: z.enum(['delete', 'highlight']).optional()
}).strict();

const particleFilterModelQuerySchema = z.union([
    particleFilterLegacyModelQuerySchema,
    particleFilterCompositeModelQuerySchema,
    particleFilterPresetModelQuerySchema
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

const applyPresetFilterBodySchema = z.object({
    timestep: z.string().min(1),
    mode: particleFilterModeSchema,
    action: z.enum(['delete', 'highlight']),
    preset: particleFilterPresetSchema,
    presetConfig: surfaceAtomsPresetConfigSchema
}).strict();

const applyFilterBodySchema = z.union([
    applyLegacyFilterBodySchema,
    applyCompositeFilterBodySchema,
    applyPresetFilterBodySchema
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

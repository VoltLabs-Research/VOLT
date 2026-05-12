import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import {
    createObjectIdParamsSchema,
    domainExposureIdSchema,
    objectIdSchema,
    paginationPageSchema,
    createPaginationLimitSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { z } from 'zod/v4';

const trajectoryAnalysisIdSchema = z.union([objectIdSchema, z.literal('default')]);
const particleFilterOperatorSchema = z.enum(['==', '!=', '>', '>=', '<', '<=']);
const particleFilterCombinatorSchema = z.enum(['AND', 'OR']);
const particleFilterConditionSchema = z.object({
    kind: z.literal('property').optional(),
    property: z.string().trim().min(1),
    operator: particleFilterOperatorSchema,
    value: z.union([z.coerce.number().finite(), z.string().trim().min(1)]),
    exposureId: domainExposureIdSchema.optional()
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

const publicCanvasParamsSchema = createObjectIdParamsSchema(['trajectoryId']);

const publicCanvasFrameParamsSchema = publicCanvasParamsSchema.extend({
    timestep: z.coerce.number().int().min(0)
}).strict();

const publicCanvasAnalysisFrameParamsSchema = publicCanvasFrameParamsSchema.extend({
    analysisId: z.string().trim().min(1),
    model: z.string().trim().min(1)
}).strict();

const publicCanvasDumpParamsSchema = publicCanvasParamsSchema.extend({
    timestep: z.string().trim().min(1)
}).strict();

const publicCanvasGlbParamsSchema = publicCanvasParamsSchema.extend({
    timestep: z.string().trim().min(1),
    analysisId: trajectoryAnalysisIdSchema
}).strict();

const publicCanvasAnalysesQuerySchema = z.object({
    page: paginationPageSchema,
    limit: createPaginationLimitSchema(100)
}).strict();

const publicCanvasAtomsParamsSchema = publicCanvasParamsSchema;

const publicCanvasAtomsQuerySchema = z.object({
    timestep: z.coerce.number().int().min(0),
    analysisId: trajectoryAnalysisIdSchema.optional(),
    page: paginationPageSchema,
    limit: createPaginationLimitSchema(100000)
}).strict();

const publicCanvasSimulationCellQuerySchema = z.object({
    timestep: z.coerce.number().int().min(0).optional()
}).strict();

const publicCanvasSceneArtifactsQuerySchema = z.object({
    sourceType: z.string().trim().min(1).optional(),
    analysisId: objectIdSchema.optional(),
    projection: z.enum(['raw', 'renderable-exposures']).optional(),
    timestep: z.coerce.number().int().min(0).optional(),
    page: paginationPageSchema,
    limit: createPaginationLimitSchema(1000)
}).strict();

const publicCanvasColorCodingAnalysisParamsSchema = publicCanvasParamsSchema.extend({
    analysisId: trajectoryAnalysisIdSchema
}).strict();

const publicCanvasColorCodingPropertiesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    exposureId: domainExposureIdSchema.optional()
}).strict();

const publicCanvasColorCodingStatsQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    type: z.string().trim().min(1),
    exposureId: domainExposureIdSchema.optional()
}).strict();

const publicCanvasColorCodingModelQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    exposureId: domainExposureIdSchema.optional(),
    startValue: z.coerce.number().finite(),
    endValue: z.coerce.number().finite(),
    gradient: z.string().trim().min(1)
}).strict();

const publicCanvasParticleFilterAnalysisParamsSchema = publicCanvasColorCodingAnalysisParamsSchema;

const publicCanvasParticleFilterPropertiesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    exposureId: domainExposureIdSchema.optional()
}).strict();

const publicCanvasParticleFilterUniqueValuesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    exposureId: domainExposureIdSchema.optional(),
    maxValues: z.coerce.number().int().min(1).optional()
}).strict();

const publicCanvasParticleFilterCompositeExpressionQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    combinator: particleFilterCombinatorSchema,
    conditions: parseConditionsQuerySchema
}).strict();

const publicCanvasParticleFilterPreviewQuerySchema = publicCanvasParticleFilterCompositeExpressionQuerySchema;

const publicCanvasParticleFilterCompositeModelQuerySchema = publicCanvasParticleFilterCompositeExpressionQuerySchema.extend({
    action: z.enum(['delete', 'highlight']).optional()
}).strict();

const publicCanvasParticleFilterModelQuerySchema = publicCanvasParticleFilterCompositeModelQuerySchema;

const publicCanvasPluginParamsSchema = publicCanvasParamsSchema.extend({
    pluginId: objectIdSchema
}).strict();

const publicCanvasListingParamsSchema = publicCanvasParamsSchema.extend({
    pluginId: objectIdSchema
}).strict();

const publicCanvasListingQuerySchema = z.object({
    exposureId: domainExposureIdSchema.optional(),
    exposureName: z.string().trim().min(1).optional(),
    analysisId: objectIdSchema.optional(),
    page: paginationPageSchema,
    limit: createPaginationLimitSchema(500),
    sortAsc: z.coerce.boolean().optional()
}).strict();

const publicCanvasSubListingParamsSchema = publicCanvasParamsSchema.extend({
    analysisId: objectIdSchema,
    exposureId: z.string().trim().min(1),
    timestep: z.coerce.number().int().min(0),
    subListingName: z.string().trim().min(1)
}).strict();

const publicCanvasSubListingQuerySchema = z.object({
    page: paginationPageSchema,
    limit: createPaginationLimitSchema(500)
}).strict();

const publicCanvasExposureGlbParamsSchema = publicCanvasParamsSchema.extend({
    analysisId: objectIdSchema,
    exposureId: z.string().trim().min(1),
    timestep: z.string().trim().min(1)
}).strict();

const publicCanvasFrameLogParamsSchema = publicCanvasParamsSchema.extend({
    analysisId: objectIdSchema,
    timestep: z.coerce.number().int().min(0)
}).strict();

const publicCanvasFrameLogQuerySchema = z.object({
    afterCursor: z.string().trim().min(1).optional()
}).strict();

export const canvasValidationSchemas = {
    getBootstrap: { params: publicCanvasParamsSchema },
    getTrajectory: { params: publicCanvasParamsSchema },
    getPreview: { params: publicCanvasParamsSchema },
    getFrame: { params: publicCanvasFrameParamsSchema },
    getAnalysisFrame: { params: publicCanvasAnalysisFrameParamsSchema },
    getDump: { params: publicCanvasDumpParamsSchema },
    getGlb: { params: publicCanvasGlbParamsSchema },
    listAnalyses: {
        params: publicCanvasParamsSchema,
        query: publicCanvasAnalysesQuerySchema
    },
    getAtoms: {
        params: publicCanvasAtomsParamsSchema,
        query: publicCanvasAtomsQuerySchema
    },
    getSimulationCell: {
        params: publicCanvasParamsSchema,
        query: publicCanvasSimulationCellQuerySchema
    },
    listSceneArtifacts: {
        params: publicCanvasParamsSchema,
        query: publicCanvasSceneArtifactsQuerySchema
    },
    getColorCodingProperties: {
        params: publicCanvasParamsSchema,
        query: publicCanvasColorCodingPropertiesQuerySchema
    },
    getColorCodingPropertiesByAnalysis: {
        params: publicCanvasColorCodingAnalysisParamsSchema,
        query: publicCanvasColorCodingPropertiesQuerySchema
    },
    getColorCodingStats: {
        params: publicCanvasParamsSchema,
        query: publicCanvasColorCodingStatsQuerySchema
    },
    getColorCodingStatsByAnalysis: {
        params: publicCanvasColorCodingAnalysisParamsSchema,
        query: publicCanvasColorCodingStatsQuerySchema
    },
    getColorCodingModel: {
        params: publicCanvasParamsSchema,
        query: publicCanvasColorCodingModelQuerySchema
    },
    getColorCodingModelByAnalysis: {
        params: publicCanvasColorCodingAnalysisParamsSchema,
        query: publicCanvasColorCodingModelQuerySchema
    },
    getParticleFilterProperties: {
        params: publicCanvasParamsSchema,
        query: publicCanvasParticleFilterPropertiesQuerySchema
    },
    getParticleFilterPropertiesByAnalysis: {
        params: publicCanvasParticleFilterAnalysisParamsSchema,
        query: publicCanvasParticleFilterPropertiesQuerySchema
    },
    getParticleFilterUniqueValues: {
        params: publicCanvasParamsSchema,
        query: publicCanvasParticleFilterUniqueValuesQuerySchema
    },
    getParticleFilterUniqueValuesByAnalysis: {
        params: publicCanvasParticleFilterAnalysisParamsSchema,
        query: publicCanvasParticleFilterUniqueValuesQuerySchema
    },
    getParticleFilterPreview: {
        params: publicCanvasParamsSchema,
        query: publicCanvasParticleFilterPreviewQuerySchema
    },
    getParticleFilterPreviewByAnalysis: {
        params: publicCanvasParticleFilterAnalysisParamsSchema,
        query: publicCanvasParticleFilterPreviewQuerySchema
    },
    getParticleFilterModel: {
        params: publicCanvasParamsSchema,
        query: publicCanvasParticleFilterModelQuerySchema
    },
    getParticleFilterModelByAnalysis: {
        params: publicCanvasParticleFilterAnalysisParamsSchema,
        query: publicCanvasParticleFilterModelQuerySchema
    },
    getPlugin: {
        params: publicCanvasPluginParamsSchema
    },
    getListing: {
        params: publicCanvasListingParamsSchema,
        query: publicCanvasListingQuerySchema
    },
    getSubListing: {
        params: publicCanvasSubListingParamsSchema,
        query: publicCanvasSubListingQuerySchema
    },
    getExposureGlb: {
        params: publicCanvasExposureGlbParamsSchema
    },
    getFrameLog: {
        params: publicCanvasFrameLogParamsSchema,
        query: publicCanvasFrameLogQuerySchema
    },
    getRasterMetadata: {
        params: publicCanvasParamsSchema
    }
} as const;

export const canvasValidation = createResourceValidation(canvasValidationSchemas);

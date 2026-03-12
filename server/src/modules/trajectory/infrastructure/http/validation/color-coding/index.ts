import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import {
    createTeamScopedParamsSchema,
    domainExposureIdSchema,
    objectIdSchema
} from '@shared/infrastructure/http/validation/shared-schemas';

import { z } from 'zod/v4';

const analysisIdSchema = z.union([objectIdSchema, z.literal('default')]);

const colorCodingParamsSchema = createTeamScopedParamsSchema('trajectoryId');

const colorCodingAnalysisParamsSchema = colorCodingParamsSchema.extend({
    analysisId: analysisIdSchema
}).strict();

const colorCodingPropertiesQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    exposureId: domainExposureIdSchema.optional()
}).strict();

const colorCodingStatsQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    type: z.string().trim().min(1),
    exposureId: domainExposureIdSchema.optional()
}).strict();

const colorCodingModelQuerySchema = z.object({
    timestep: z.string().trim().min(1),
    property: z.string().trim().min(1),
    exposureId: domainExposureIdSchema.optional(),
    startValue: z.coerce.number().finite(),
    endValue: z.coerce.number().finite(),
    gradient: z.string().trim().min(1)
}).strict();

const applyColorCodingBodySchema = z.object({
    timestep: z.string().min(1),
    property: z.string().min(1),
    startValue: z.coerce.number().finite(),
    endValue: z.coerce.number().finite(),
    gradient: z.string().min(1),
    exposureId: domainExposureIdSchema.optional()
}).strict();

export const colorCodingValidation = createResourceValidation({
    getProperties: {
        params: colorCodingParamsSchema,
        query: colorCodingPropertiesQuerySchema
    },
    getPropertiesByAnalysis: {
        params: colorCodingAnalysisParamsSchema,
        query: colorCodingPropertiesQuerySchema
    },
    getStats: {
        params: colorCodingParamsSchema,
        query: colorCodingStatsQuerySchema
    },
    getStatsByAnalysis: {
        params: colorCodingAnalysisParamsSchema,
        query: colorCodingStatsQuerySchema
    },
    getModel: {
        params: colorCodingParamsSchema,
        query: colorCodingModelQuerySchema
    },
    getModelByAnalysis: {
        params: colorCodingAnalysisParamsSchema,
        query: colorCodingModelQuerySchema
    },
    applyColorCoding: {
        params: colorCodingParamsSchema,
        body: applyColorCodingBodySchema
    },
    applyColorCodingByAnalysis: {
        params: colorCodingAnalysisParamsSchema,
        body: applyColorCodingBodySchema
    }
});

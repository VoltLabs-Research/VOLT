import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import {
    createPaginationQuerySchema,
    createTeamScopedParamsSchema,
    domainExposureIdSchema,
    objectIdSchema
} from '@shared/infrastructure/http/validation/shared-schemas';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import { z } from 'zod/v4';

const pluginListingParamsSchema = createTeamScopedParamsSchema('pluginId');
const pluginListingTrajectoryParamsSchema = pluginListingParamsSchema.extend({
    trajectoryId: objectIdSchema
}).strict();
const analysisListingParamsSchema = createTeamScopedParamsSchema('analysisId');
const subListingNameParamSchema = z.string().trim().min(1);
const exportFormatQuerySchema = z.nativeEnum(ExportType).optional();

const optionalBooleanQuerySchema = z.preprocess((value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true') {
        return true;
    }

    if (normalizedValue === 'false') {
        return false;
    }

    return value;
}, z.boolean().optional());

const optionalStringArrayQuerySchema = z.preprocess((value) => {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (value === '') {
        return [];
    }

    const values = Array.isArray(value) ? value : [value];

    return values
        .flatMap((entry) => String(entry).split(','))
        .map((entry) => entry.trim())
        .filter(Boolean);
}, z.array(z.string().trim().min(1)).optional());

const stripLegacyTeamIdFromQuery = (value: unknown) => {
    const query = asRecord(value);

    if (!query) {
        return value;
    }

    const nextQuery = { ...query };
    delete nextQuery.teamId;

    return nextQuery;
};

const createListingPaginationSchema = () => createPaginationQuerySchema({
    maxLimit: 200
});

const createLegacySafeQuerySchema = <TSchema extends z.ZodTypeAny>(schema: TSchema) => {
    return z.preprocess(stripLegacyTeamIdFromQuery, schema);
};

const pluginListingQuerySchema = z.preprocess(
    stripLegacyTeamIdFromQuery,
    createListingPaginationSchema().extend({
        analysisId: objectIdSchema.optional(),
        exposureId: domainExposureIdSchema.optional(),
        exposureName: z.string().trim().optional(),
        sortAsc: optionalBooleanQuerySchema,
        trajectoryId: objectIdSchema.optional()
    }).strict()
);

const analysisListingQuerySchema = createLegacySafeQuerySchema(
    createListingPaginationSchema().extend({
        sortAsc: optionalBooleanQuerySchema
    }).strict()
);

const subListingParamsSchema = analysisListingParamsSchema.extend({
    exposureId: domainExposureIdSchema,
    timestep: z.coerce.number().int().min(0),
    subListingName: subListingNameParamSchema
}).strict();

const subListingQuerySchema = createLegacySafeQuerySchema(
    createListingPaginationSchema().strict()
);

const analysisListingExportQuerySchema = createLegacySafeQuerySchema(
    z.object({
        format: exportFormatQuerySchema,
        includeConfig: optionalBooleanQuerySchema,
        selectedListingIds: optionalStringArrayQuerySchema,
        selectedSubListingIds: optionalStringArrayQuerySchema
    }).strict()
);

const analysisListingExportOptionsQuerySchema = createLegacySafeQuerySchema(
    z.object({
    }).strict()
);

const pluginListingExportQuerySchema = createLegacySafeQuerySchema(
    z.object({
        analysisId: objectIdSchema.optional(),
        exposureId: domainExposureIdSchema.optional(),
        exposureName: z.string().trim().optional(),
        format: exportFormatQuerySchema
    }).strict()
);

export const listingRowValidation = createResourceValidation({
    getListingRowsByAnalysisId: {
        params: analysisListingParamsSchema,
        query: analysisListingQuerySchema
    },
    getSubListing: {
        params: subListingParamsSchema,
        query: subListingQuerySchema
    },
    exportListingRowsByAnalysisId: {
        params: analysisListingParamsSchema,
        query: analysisListingExportQuerySchema
    },
    getAnalysisListingExportOptions: {
        params: analysisListingParamsSchema,
        query: analysisListingExportOptionsQuerySchema
    },
    getPluginListingDocuments: {
        params: pluginListingParamsSchema,
        query: pluginListingQuerySchema
    },
    exportPluginListingDocuments: {
        params: pluginListingParamsSchema,
        query: pluginListingExportQuerySchema
    },
    exportPluginTrajectoryListingDocuments: {
        params: pluginListingTrajectoryParamsSchema,
        query: pluginListingExportQuerySchema
    }
});

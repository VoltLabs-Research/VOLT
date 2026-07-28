import { z } from 'zod';
import { PluginStatus } from './domain/enums';

const exportFormats = ['json', 'csv'] as const;

export const pluginRefSchema = z.object({ pluginId: z.string() });

export const installPluginSchema = z.object({
    name: z.string(),
    version: z.string().optional()
});

export const searchRegistryPluginsSchema = z.object({
    q: z.string().optional(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(20)
});

export const listPluginsSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50),
    status: z.nativeEnum(PluginStatus).optional()
});

export const comparePluginsSchema = z.object({
    pluginIdA: z.string(),
    pluginIdB: z.string()
});

export const validateWorkflowSchema = z.object({
    workflow: z.object({
        nodes: z.array(z.record(z.string(), z.unknown())),
        edges: z.array(z.record(z.string(), z.unknown())),
        viewport: z.object({
            x: z.number(),
            y: z.number(),
            zoom: z.number()
        }).optional()
    }),
    pluginId: z.string().optional()
});

export const uninstallPluginSchema = z.object({ pluginId: z.string(), reason: z.string().optional() });

export const executePipelineSchema = z.object({
    trajectoryId: z.string(),
    stages: z.array(z.object({
        pluginId: z.string(),
        config: z.record(z.string(), z.unknown()).optional().default({})
    })).min(1).describe('Ordered plugin stages. An upstream stage must precede any stage that consumes its exposures.'),
    selectedTimesteps: z.array(z.number()).optional(),
    teamClusterId: z.string().optional(),
    reason: z.string().optional()
});

export const listPluginListingDocumentsSchema = z.object({
    pluginId: z.string(),
    analysisId: z.string().optional(),
    trajectoryId: z.string().optional(),
    exposureId: z.string().optional(),
    exposureName: z.string().optional(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50),
    sortAsc: z.boolean().optional()
});

export const listAnalysisResultOptionsSchema = z.object({ analysisId: z.string() });

export const readAnalysisResultRowsSchema = z.object({
    analysisId: z.string(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50)
});

export const getSubListingSchema = z.object({
    analysisId: z.string(),
    exposureId: z.string(),
    timestep: z.number(),
    subListingName: z.string(),
    page: z.number().optional(),
    limit: z.number().optional()
});

export const summarizeAnalysisResultSchema = z.object({
    analysisId: z.string(),
    exposureId: z.string().optional(),
    maxRows: z.number().optional()
});

export const exportAnalysisResultSchema = z.object({
    analysisId: z.string(),
    format: z.enum(exportFormats).optional(),
    includeConfig: z.boolean().optional(),
    selectedListingIds: z.array(z.string()).optional(),
    selectedSubListingIds: z.array(z.string()).optional(),
    sortAsc: z.boolean().optional()
});

export type PluginRefInput = z.infer<typeof pluginRefSchema>;
export type InstallPluginInput = z.infer<typeof installPluginSchema>;
export type SearchRegistryPluginsInput = z.infer<typeof searchRegistryPluginsSchema>;
export type ListPluginsInput = z.infer<typeof listPluginsSchema>;
export type ComparePluginsInput = z.infer<typeof comparePluginsSchema>;
export type ValidateWorkflowInput = z.infer<typeof validateWorkflowSchema>;
export type UninstallPluginInput = z.infer<typeof uninstallPluginSchema>;
export type ExecutePipelineInput = z.infer<typeof executePipelineSchema>;
export type ListPluginListingDocumentsInput = z.infer<typeof listPluginListingDocumentsSchema>;
export type ListAnalysisResultOptionsInput = z.infer<typeof listAnalysisResultOptionsSchema>;
export type ReadAnalysisResultRowsInput = z.infer<typeof readAnalysisResultRowsSchema>;
export type GetSubListingInput = z.infer<typeof getSubListingSchema>;
export type SummarizeAnalysisResultInput = z.infer<typeof summarizeAnalysisResultSchema>;
export type ExportAnalysisResultInput = z.infer<typeof exportAnalysisResultSchema>;

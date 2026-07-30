import type { tags } from 'typia';
import type { PluginStatus } from './enums';
import type { IViewport } from './workflow';

// Free-form key/value bag. Aliased so the generated schema does not inherit the
// TypeScript standard library's JSDoc for `Record` as a model-facing description.
type UnknownRecord = Record<string, unknown>;

export interface PluginRefInput{
    pluginId: string;
}

export interface InstallPluginInput{
    name: string;
    version?: string;
}

export interface SearchRegistryPluginsInput{
    q?: string;
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<20>;
}

export interface ListPluginsInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
    status?: PluginStatus;
}

export interface ComparePluginsInput{
    pluginIdA: string;
    pluginIdB: string;
}

export interface WorkflowGraphInput{
    nodes: UnknownRecord[];
    edges: UnknownRecord[];
    viewport?: IViewport;
}

export interface ValidateWorkflowInput{
    workflow: WorkflowGraphInput;
    pluginId?: string;
}

export interface UninstallPluginInput{
    pluginId: string;
    reason?: string;
}

export interface PipelineStageInput{
    pluginId: string;
    // `tags.Default` accepts primitives only, so the empty-object default is
    // injected through typia's JSON-schema tag to keep the schema unchanged.
    config?: { [key: string]: unknown } & tags.JsonSchemaPlugin<{ default: {} }>;
}

export interface ExecutePipelineInput{
    trajectoryId: string;
    /**
     * Ordered plugin stages. An upstream stage must precede any stage that consumes its exposures.
     */
    stages: PipelineStageInput[] & tags.MinItems<1>;
    selectedTimesteps?: number[];
    teamClusterId?: string;
    reason?: string;
}

export interface ListPluginListingDocumentsInput{
    pluginId: string;
    analysisId?: string;
    trajectoryId?: string;
    exposureId?: string;
    exposureName?: string;
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
    sortAsc?: boolean;
}

export interface ListAnalysisResultOptionsInput{
    analysisId: string;
}

export interface ReadAnalysisResultRowsInput{
    analysisId: string;
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
}

export interface GetSubListingInput{
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    page?: number;
    limit?: number;
}

export interface SummarizeAnalysisResultInput{
    analysisId: string;
    exposureId?: string;
    maxRows?: number;
}

export interface ExportAnalysisResultInput{
    analysisId: string;
    format?: 'json' | 'csv';
    includeConfig?: boolean;
    selectedListingIds?: string[];
    selectedSubListingIds?: string[];
    sortAsc?: boolean;
}

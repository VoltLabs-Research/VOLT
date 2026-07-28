import { get, post, patch, del } from '../../shared/routing';
import type {
    ValidateWorkflowInput,
    CreatePluginInput,
    UpdatePluginInput,
    InstallRegistryPluginInput,
    UploadBinaryInput,
    CommitBinaryUploadInput,
    ExecutePipelineInput
} from './http';
import type {
    Plugin,
    CreatePluginResponse,
    GetPluginResponse,
    UpdatePluginResponse,
    ClonePluginResponse,
    InstallRegistryPluginResponse,
    ImportPluginResponse,
    GetNodeTypesSchemaResponse,
    ValidateWorkflowResponse,
    BinaryUploadResult,
    BinaryUploadTarget,
    ExecutePipelineResponse
} from './domain/plugin';
import type { SearchRegistryResponse } from './domain/registry';
import type {
    ListingRowData,
    ListingRowByAnalysisData,
    SubListingRowData,
    GetAnalysisListingExportOptionsResponse
} from './domain/listing';

export const pluginRoutes = {
    
    getListingRowsByAnalysisId: get<ListingRowByAnalysisData>('/api/teams/:teamId/plugins/listings/analyses/:analysisId'),
    getAnalysisListingExportOptions: get<GetAnalysisListingExportOptionsResponse>('/api/teams/:teamId/plugins/listings/analyses/:analysisId/export/options'),
    exportListingRowsByAnalysisId: get<Blob>('/api/teams/:teamId/plugins/listings/analyses/:analysisId/export'),
    getSubListing: get<SubListingRowData>('/api/teams/:teamId/plugins/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'),
    exportPluginListingDocuments: get<Blob>('/api/teams/:teamId/plugins/:pluginId/listings/export'),
    getPluginListingDocuments: get<ListingRowData>('/api/teams/:teamId/plugins/:pluginId/listings'),

    
    getPluginExposureGLB: get<Blob>('/api/teams/:teamId/plugins/exposures/:trajectoryId/:analysisId/:exposureId/:timestep/glb'),
    getPluginExposureChart: get<Blob>('/api/teams/:teamId/plugins/exposures/artifacts/:artifactId/chart'),
    getPluginExposureExport: get<Blob>('/api/teams/:teamId/plugins/exposures/analyses/:analysisId/export'),

    
    getNodeTypesSchema: get<GetNodeTypesSchemaResponse>('/api/teams/:teamId/plugins/node-types/schema'),
    validateWorkflow: post<ValidateWorkflowInput, ValidateWorkflowResponse>('/api/teams/:teamId/plugins/workflow-validations'),
    exportPlugin: get<Blob>('/api/teams/:teamId/plugins/:pluginId/export'),
    importPlugin: post<never, ImportPluginResponse>('/api/teams/:teamId/plugins/imports'),
    searchRegistry: get<SearchRegistryResponse>('/api/teams/:teamId/plugins/registry/search'),
    installRegistry: post<InstallRegistryPluginInput, InstallRegistryPluginResponse>('/api/teams/:teamId/plugins/registry/installations'),
    list: get<Plugin>('/api/teams/:teamId/plugins'),
    create: post<CreatePluginInput, CreatePluginResponse>('/api/teams/:teamId/plugins'),
    commitBinaryUpload: post<CommitBinaryUploadInput, BinaryUploadResult>('/api/teams/:teamId/plugins/:pluginId/binary/commits'),
    downloadBinary: get<Blob>('/api/teams/:teamId/plugins/:pluginId/binary'),
    uploadBinary: patch<UploadBinaryInput, BinaryUploadTarget>('/api/teams/:teamId/plugins/:pluginId/binary'),
    removeBinary: del('/api/teams/:teamId/plugins/:pluginId/binary'),
    clone: post<never, ClonePluginResponse>('/api/teams/:teamId/plugins/:pluginId/clones'),
    get: get<GetPluginResponse>('/api/teams/:teamId/plugins/:pluginId'),
    update: patch<UpdatePluginInput, UpdatePluginResponse>('/api/teams/:teamId/plugins/:pluginId'),
    remove: del('/api/teams/:teamId/plugins/:pluginId'),
    executePipeline: post<ExecutePipelineInput, ExecutePipelineResponse>('/api/teams/:teamId/plugins/trajectories/:trajectoryId/pipeline-executions')
} as const;

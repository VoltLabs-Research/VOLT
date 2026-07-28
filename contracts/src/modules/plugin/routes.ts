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
    
    getListingRowsByAnalysisId: get<ListingRowByAnalysisData>('/api/plugins/:teamId/listings/analyses/:analysisId'),
    getAnalysisListingExportOptions: get<GetAnalysisListingExportOptionsResponse>('/api/plugins/:teamId/listings/analyses/:analysisId/export/options'),
    exportListingRowsByAnalysisId: get<Blob>('/api/plugins/:teamId/listings/analyses/:analysisId/export'),
    getSubListing: get<SubListingRowData>('/api/plugins/:teamId/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'),
    exportPluginListingDocuments: get<Blob>('/api/plugins/:teamId/:pluginId/listings/export'),
    exportPluginListingDocumentsByTrajectory: get<Blob>('/api/plugins/:teamId/:pluginId/listings/trajectories/:trajectoryId/export'),
    getPluginListingDocuments: get<ListingRowData>('/api/plugins/:teamId/:pluginId/listings'),

    
    getPluginExposureGLB: get<Blob>('/api/plugins/:teamId/exposures/glb/:trajectoryId/:analysisId/:exposureId/:timestep'),
    getPluginExposureChart: get<Blob>('/api/plugins/:teamId/exposures/artifacts/:artifactId/chart'),
    getPluginExposureExport: get<Blob>('/api/plugins/:teamId/exposures/analyses/:analysisId/export'),

    
    getNodeTypesSchema: get<GetNodeTypesSchemaResponse>('/api/plugins/:teamId/node-types/schema'),
    validateWorkflow: post<ValidateWorkflowInput, ValidateWorkflowResponse>('/api/plugins/:teamId/workflow-validation'),
    exportPlugin: get<Blob>('/api/plugins/:teamId/:pluginId/export'),
    importPlugin: post<never, ImportPluginResponse>('/api/plugins/:teamId/import'),
    searchRegistry: get<SearchRegistryResponse>('/api/plugins/:teamId/registry/search'),
    installRegistry: post<InstallRegistryPluginInput, InstallRegistryPluginResponse>('/api/plugins/:teamId/registry/install'),
    list: get<Plugin>('/api/plugins/:teamId'),
    create: post<CreatePluginInput, CreatePluginResponse>('/api/plugins/:teamId'),
    commitBinaryUpload: post<CommitBinaryUploadInput, BinaryUploadResult>('/api/plugins/:teamId/:pluginId/binary/commit'),
    downloadBinary: get<Blob>('/api/plugins/:teamId/:pluginId/binary'),
    uploadBinary: patch<UploadBinaryInput, BinaryUploadTarget>('/api/plugins/:teamId/:pluginId/binary'),
    removeBinary: del('/api/plugins/:teamId/:pluginId/binary'),
    clone: post<never, ClonePluginResponse>('/api/plugins/:teamId/:pluginId/clones'),
    get: get<GetPluginResponse>('/api/plugins/:teamId/:pluginId'),
    update: patch<UpdatePluginInput, UpdatePluginResponse>('/api/plugins/:teamId/:pluginId'),
    remove: del('/api/plugins/:teamId/:pluginId'),
    executePipeline: post<ExecutePipelineInput, ExecutePipelineResponse>('/api/plugins/:teamId/trajectories/:trajectoryId/pipeline-executions')
} as const;

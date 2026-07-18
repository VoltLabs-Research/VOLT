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
    PersistedPlugin,
    CreatePluginResponse,
    GetPluginResponse,
    UpdatePluginResponse,
    ClonePluginResponse,
    InstallRegistryPluginResponse,
    ImportPluginResponse,
    GetNodeTypesSchemaResponse,
    ValidateWorkflowResponse,
    SearchRegistryResponse,
    BinaryUploadResult,
    BinaryUploadTarget,
    ExecutePipelineResponse,
    ListingRowData,
    ListingRowByAnalysisData,
    SubListingRowData,
    GetAnalysisListingExportOptionsResponse
} from './domain';

/**
 * Every client-facing plugin endpoint, typed by request/response. All paths are
 * the full wire paths (team-scoped under `/api/plugins/:teamId`), matching the
 * three previous `createHttpModule({ basePath: '/api/plugins/:teamId' })` route
 * files verbatim. Binary downloads (`exportPlugin`, `downloadBinary`, the three
 * `getPluginExposure*` routes and the two listing-row exports) resolve to a
 * `Blob` on the wire — the controller returns a streamed `DownloadStreamOutput`
 * that the `Controller` base pipes to the response.
 *
 * ORDER MATTERS for the single controller router: the listing-row and exposure
 * routes are declared BEFORE the plugin `/:pluginId` param routes (mirroring the
 * old mount order, where `PluginListingRowHttpModule` + `PluginExposureHttpModule`
 * mounted ahead of `PluginHttpModule`), so Express matches the literal
 * `/listings/*` and `/exposures/*` families before the `/:pluginId` catch-alls.
 */
export const pluginRoutes = {
    // ---- listing-row (declared first) -------------------------------------
    getListingRowsByAnalysisId: get<ListingRowByAnalysisData>('/api/plugins/:teamId/listings/analyses/:analysisId'),
    getAnalysisListingExportOptions: get<GetAnalysisListingExportOptionsResponse>('/api/plugins/:teamId/listings/analyses/:analysisId/export/options'),
    exportListingRowsByAnalysisId: get<Blob>('/api/plugins/:teamId/listings/analyses/:analysisId/export'),
    getSubListing: get<SubListingRowData>('/api/plugins/:teamId/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'),
    exportPluginListingDocuments: get<Blob>('/api/plugins/:teamId/:pluginId/listings/export'),
    exportPluginListingDocumentsByTrajectory: get<Blob>('/api/plugins/:teamId/:pluginId/listings/trajectories/:trajectoryId/export'),
    getPluginListingDocuments: get<ListingRowData>('/api/plugins/:teamId/:pluginId/listings'),

    // ---- exposure ---------------------------------------------------------
    getPluginExposureGLB: get<Blob>('/api/plugins/:teamId/exposures/glb/:trajectoryId/:analysisId/:exposureId/:timestep'),
    getPluginExposureChart: get<Blob>('/api/plugins/:teamId/exposures/artifacts/:artifactId/chart'),
    getPluginExposureExport: get<Blob>('/api/plugins/:teamId/exposures/analyses/:analysisId/export'),

    // ---- plugin -----------------------------------------------------------
    getNodeTypesSchema: get<GetNodeTypesSchemaResponse>('/api/plugins/:teamId/node-types/schema'),
    validateWorkflow: post<ValidateWorkflowInput, ValidateWorkflowResponse>('/api/plugins/:teamId/workflow-validation'),
    exportPlugin: get<Blob>('/api/plugins/:teamId/:pluginId/export'),
    importPlugin: post<never, ImportPluginResponse>('/api/plugins/:teamId/import'),
    searchRegistry: get<SearchRegistryResponse>('/api/plugins/:teamId/registry/search'),
    installRegistry: post<InstallRegistryPluginInput, InstallRegistryPluginResponse>('/api/plugins/:teamId/registry/install'),
    list: get<PersistedPlugin>('/api/plugins/:teamId'),
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

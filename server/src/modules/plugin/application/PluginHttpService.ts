import { ClonePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ClonePluginUseCase';
import { CommitBinaryUploadUseCase } from '@modules/plugin/application/use-cases/plugin/CommitBinaryUploadUseCase';
import { CreatePluginUseCase } from '@modules/plugin/application/use-cases/plugin/CreatePluginUseCase';
import { DeleteBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/DeleteBinaryUseCase';
import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';
import { DownloadPluginBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/DownloadPluginBinaryUseCase';
import { ExecutePipelineUseCase } from '@modules/plugin/application/use-cases/plugin/ExecutePipelineUseCase';
import { ExportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExportPluginUseCase';
import GetNodeTypesSchemaUseCase from '@modules/plugin/application/use-cases/plugin/GetNodeTypesSchemaUseCase';
import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';
import { ImportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ImportPluginUseCase';
import { ListPluginsUseCase } from '@modules/plugin/application/use-cases/plugin/ListPluginsUseCase';
import { RegistryInstallPluginUseCase } from '@modules/plugin/application/use-cases/plugin/RegistryInstallPluginUseCase';
import { SearchRegistryPluginsUseCase } from '@modules/plugin/application/use-cases/plugin/SearchRegistryPluginsUseCase';
import { UpdatePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase';
import { UploadBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/UploadBinaryUseCase';
import { ValidateWorkflowUseCase } from '@modules/plugin/application/use-cases/plugin/ValidateWorkflowUseCase';

import { GetPluginExposureChartUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureChartUseCase';
import { GetPluginExposureExportUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureExportUseCase';
import { GetPluginExposureGLBUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureGLBUseCase';

import { ExportListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportListingRowsByAnalysisIdUseCase';
import { ExportPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportPluginListingDocumentsUseCase';
import { GetAnalysisListingExportOptionsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetAnalysisListingExportOptionsUseCase';
import { GetListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/GetListingRowsByAnalysisIdUseCase';
import { GetPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetPluginListingDocumentsUseCase';
import { GetSubListingUseCase } from '@modules/plugin/application/use-cases/listing-row/GetSubListingUseCase';

import type { ClonePluginInputDTO } from '@modules/plugin/application/dtos/plugin/ClonePluginDTO';
import type { CreatePluginInputDTO } from '@modules/plugin/application/dtos/plugin/CreatePluginDTO';
import type { DeleteBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/DeleteBinaryDTO';
import type { DeletePluginByIdInputDTO } from '@modules/plugin/application/dtos/plugin/DeletePluginByIdDTO';
import type { DownloadPluginBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/DownloadPluginBinaryDTO';
import type { ExecutePipelineInputDTO } from '@modules/plugin/application/dtos/plugin/ExecutePipelineDTO';
import type { ExportPluginInputDTO } from '@modules/plugin/application/dtos/plugin/ExportPluginDTO';
import type { GetPluginByIdInputDTO } from '@modules/plugin/application/dtos/plugin/GetPluginByIdDTO';
import type { ImportPluginInputDTO } from '@modules/plugin/application/dtos/plugin/ImportPluginDTO';
import type { ListPluginsInputDTO } from '@modules/plugin/application/dtos/plugin/ListPluginsDTO';
import type { RegistryInstallPluginInputDTO } from '@modules/plugin/application/dtos/plugin/RegistryInstallPluginDTO';
import type { SearchRegistryPluginsInputDTO } from '@modules/plugin/application/dtos/plugin/SearchRegistryPluginsDTO';
import type { UpdatePluginByIdInputDTO } from '@modules/plugin/application/dtos/plugin/UpdatePluginByIdDTO';
import type { CommitBinaryUploadInputDTO, UploadBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import type { ValidateWorkflowInputDTO } from '@modules/plugin/application/dtos/plugin/ValidateWorkflowDTO';

import type { GetPluginExposureChartInputDTO } from '@modules/plugin/application/dtos/exposure/GetPluginExposureChartDTO';
import type { GetPluginExposureExportInputDTO } from '@modules/plugin/application/dtos/exposure/GetPluginExposureExportDTO';
import type { GetPluginExposureGLBInputDTO } from '@modules/plugin/application/dtos/exposure/GetPluginExposureGLBDTO';

import type { GetAnalysisListingExportOptionsInputDTO } from '@modules/plugin/application/dtos/listing-row/GetAnalysisListingExportOptionsDTO';
import type {
    ExportListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdInputDTO
} from '@modules/plugin/application/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import type {
    ExportPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsInputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { GetSubListingInputDTO } from '@modules/plugin/application/dtos/listing-row/GetSubListingDTO';

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single HTTP-facing application service for the plugin module. Each method
 * DELEGATES to the existing, still-registered use case (kept intact because
 * many are cross-consumed by AI tools, event handlers and shared/contracts
 * ports) and unwraps the `Result` error channel into a thrown error so Express
 * 5 forwards it to `httpErrorMiddleware`. No workflow / execution / dependency
 * / validation / registry logic is moved here — that stays in the domain and
 * infrastructure services the use cases already depend on.
 */
@Singleton(PLUGIN_TOKENS.PluginHttpService)
export default class PluginHttpService {
    constructor(
        @inject(ClonePluginUseCase) private readonly clonePluginUseCase: ClonePluginUseCase,
        @inject(CommitBinaryUploadUseCase) private readonly commitBinaryUploadUseCase: CommitBinaryUploadUseCase,
        @inject(CreatePluginUseCase) private readonly createPluginUseCase: CreatePluginUseCase,
        @inject(DeleteBinaryUseCase) private readonly deleteBinaryUseCase: DeleteBinaryUseCase,
        @inject(DeletePluginByIdUseCase) private readonly deletePluginByIdUseCase: DeletePluginByIdUseCase,
        @inject(DownloadPluginBinaryUseCase) private readonly downloadPluginBinaryUseCase: DownloadPluginBinaryUseCase,
        @inject(ExecutePipelineUseCase) private readonly executePipelineUseCase: ExecutePipelineUseCase,
        @inject(ExportPluginUseCase) private readonly exportPluginUseCase: ExportPluginUseCase,
        @inject(GetNodeTypesSchemaUseCase) private readonly getNodeTypesSchemaUseCase: GetNodeTypesSchemaUseCase,
        @inject(GetPluginByIdUseCase) private readonly getPluginByIdUseCase: GetPluginByIdUseCase,
        @inject(ImportPluginUseCase) private readonly importPluginUseCase: ImportPluginUseCase,
        @inject(ListPluginsUseCase) private readonly listPluginsUseCase: ListPluginsUseCase,
        @inject(RegistryInstallPluginUseCase) private readonly registryInstallPluginUseCase: RegistryInstallPluginUseCase,
        @inject(SearchRegistryPluginsUseCase) private readonly searchRegistryPluginsUseCase: SearchRegistryPluginsUseCase,
        @inject(UpdatePluginByIdUseCase) private readonly updatePluginByIdUseCase: UpdatePluginByIdUseCase,
        @inject(UploadBinaryUseCase) private readonly uploadBinaryUseCase: UploadBinaryUseCase,
        @inject(ValidateWorkflowUseCase) private readonly validateWorkflowUseCase: ValidateWorkflowUseCase,
        @inject(GetPluginExposureChartUseCase) private readonly getPluginExposureChartUseCase: GetPluginExposureChartUseCase,
        @inject(GetPluginExposureExportUseCase) private readonly getPluginExposureExportUseCase: GetPluginExposureExportUseCase,
        @inject(GetPluginExposureGLBUseCase) private readonly getPluginExposureGLBUseCase: GetPluginExposureGLBUseCase,
        @inject(ExportListingRowsByAnalysisIdUseCase) private readonly exportListingRowsByAnalysisIdUseCase: ExportListingRowsByAnalysisIdUseCase,
        @inject(ExportPluginListingDocumentsUseCase) private readonly exportPluginListingDocumentsUseCase: ExportPluginListingDocumentsUseCase,
        @inject(GetAnalysisListingExportOptionsUseCase) private readonly getAnalysisListingExportOptionsUseCase: GetAnalysisListingExportOptionsUseCase,
        @inject(GetListingRowsByAnalysisIdUseCase) private readonly getListingRowsByAnalysisIdUseCase: GetListingRowsByAnalysisIdUseCase,
        @inject(GetPluginListingDocumentsUseCase) private readonly getPluginListingDocumentsUseCase: GetPluginListingDocumentsUseCase,
        @inject(GetSubListingUseCase) private readonly getSubListingUseCase: GetSubListingUseCase
    ) {}


    // -- plugin ------------------------------------------------------------

    async getNodeTypesSchema() {
        return this.getNodeTypesSchemaUseCase.execute();
    }

    async validateWorkflow(input: ValidateWorkflowInputDTO) {
        return this.validateWorkflowUseCase.execute(input);
    }

    async exportPlugin(input: ExportPluginInputDTO) {
        return this.exportPluginUseCase.execute(input);
    }

    async importPlugin(input: ImportPluginInputDTO) {
        return this.importPluginUseCase.execute(input);
    }

    async searchRegistry(input: SearchRegistryPluginsInputDTO) {
        return this.searchRegistryPluginsUseCase.execute(input);
    }

    async installRegistry(input: RegistryInstallPluginInputDTO) {
        return this.registryInstallPluginUseCase.execute(input);
    }

    async listPlugins(input: ListPluginsInputDTO) {
        return this.listPluginsUseCase.execute(input);
    }

    async createPlugin(input: CreatePluginInputDTO) {
        return this.createPluginUseCase.execute(input);
    }

    async commitBinaryUpload(input: CommitBinaryUploadInputDTO) {
        return this.commitBinaryUploadUseCase.execute(input);
    }

    async downloadBinary(input: DownloadPluginBinaryInputDTO) {
        return this.downloadPluginBinaryUseCase.execute(input);
    }

    async uploadBinary(input: UploadBinaryInputDTO) {
        return this.uploadBinaryUseCase.execute(input);
    }

    async deleteBinary(input: DeleteBinaryInputDTO) {
        return this.deleteBinaryUseCase.execute(input);
    }

    async clonePlugin(input: ClonePluginInputDTO) {
        return this.clonePluginUseCase.execute(input);
    }

    async getPluginById(input: GetPluginByIdInputDTO) {
        return this.getPluginByIdUseCase.execute(input);
    }

    async updatePluginById(input: UpdatePluginByIdInputDTO) {
        return this.updatePluginByIdUseCase.execute(input);
    }

    async deletePluginById(input: DeletePluginByIdInputDTO) {
        return this.deletePluginByIdUseCase.execute(input);
    }

    async executePipeline(input: ExecutePipelineInputDTO) {
        return this.executePipelineUseCase.execute(input);
    }

    // -- exposure ----------------------------------------------------------

    async getPluginExposureGLB(input: GetPluginExposureGLBInputDTO) {
        return this.getPluginExposureGLBUseCase.execute(input);
    }

    async getPluginExposureChart(input: GetPluginExposureChartInputDTO) {
        return this.getPluginExposureChartUseCase.execute(input);
    }

    async getPluginExposureExport(input: GetPluginExposureExportInputDTO) {
        return this.getPluginExposureExportUseCase.execute(input);
    }

    // -- listing-row -------------------------------------------------------

    async getListingRowsByAnalysisId(input: GetListingRowsByAnalysisIdInputDTO) {
        return this.getListingRowsByAnalysisIdUseCase.execute(input);
    }

    async getAnalysisListingExportOptions(input: GetAnalysisListingExportOptionsInputDTO) {
        return this.getAnalysisListingExportOptionsUseCase.execute(input);
    }

    async exportListingRowsByAnalysisId(input: ExportListingRowsByAnalysisIdInputDTO) {
        return this.exportListingRowsByAnalysisIdUseCase.execute(input);
    }

    async getSubListing(input: GetSubListingInputDTO) {
        return this.getSubListingUseCase.execute(input);
    }

    async exportPluginListingDocuments(input: ExportPluginListingDocumentsInputDTO) {
        return this.exportPluginListingDocumentsUseCase.execute(input);
    }

    async getPluginListingDocuments(input: GetPluginListingDocumentsInputDTO) {
        return this.getPluginListingDocumentsUseCase.execute(input);
    }
}

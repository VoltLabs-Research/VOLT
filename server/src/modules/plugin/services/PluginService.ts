import { ClonePluginUseCase } from '@modules/plugin/use-cases/plugin/ClonePluginUseCase';
import { CommitBinaryUploadUseCase } from '@modules/plugin/use-cases/plugin/CommitBinaryUploadUseCase';
import { CreatePluginUseCase } from '@modules/plugin/use-cases/plugin/CreatePluginUseCase';
import { DeleteBinaryUseCase } from '@modules/plugin/use-cases/plugin/DeleteBinaryUseCase';
import { DeletePluginByIdUseCase } from '@modules/plugin/use-cases/plugin/DeletePluginByIdUseCase';
import { DownloadPluginBinaryUseCase } from '@modules/plugin/use-cases/plugin/DownloadPluginBinaryUseCase';
import { ExecutePipelineUseCase } from '@modules/plugin/use-cases/plugin/ExecutePipelineUseCase';
import { ExportPluginUseCase } from '@modules/plugin/use-cases/plugin/ExportPluginUseCase';
import GetNodeTypesSchemaUseCase from '@modules/plugin/use-cases/plugin/GetNodeTypesSchemaUseCase';
import { GetPluginByIdUseCase } from '@modules/plugin/use-cases/plugin/GetPluginByIdUseCase';
import { ImportPluginUseCase } from '@modules/plugin/use-cases/plugin/ImportPluginUseCase';
import { ListPluginsUseCase } from '@modules/plugin/use-cases/plugin/ListPluginsUseCase';
import { RegistryInstallPluginUseCase } from '@modules/plugin/use-cases/plugin/RegistryInstallPluginUseCase';
import { SearchRegistryPluginsUseCase } from '@modules/plugin/use-cases/plugin/SearchRegistryPluginsUseCase';
import { UpdatePluginByIdUseCase } from '@modules/plugin/use-cases/plugin/UpdatePluginByIdUseCase';
import { UploadBinaryUseCase } from '@modules/plugin/use-cases/plugin/UploadBinaryUseCase';
import { ValidateWorkflowUseCase } from '@modules/plugin/use-cases/plugin/ValidateWorkflowUseCase';

import { GetPluginExposureChartUseCase } from '@modules/plugin/use-cases/exposure/GetPluginExposureChartUseCase';
import { GetPluginExposureExportUseCase } from '@modules/plugin/use-cases/exposure/GetPluginExposureExportUseCase';
import { GetPluginExposureGLBUseCase } from '@modules/plugin/use-cases/exposure/GetPluginExposureGLBUseCase';

import { ExportListingRowsByAnalysisIdUseCase } from '@modules/plugin/use-cases/listing-row/ExportListingRowsByAnalysisIdUseCase';
import { ExportPluginListingDocumentsUseCase } from '@modules/plugin/use-cases/listing-row/ExportPluginListingDocumentsUseCase';
import { GetAnalysisListingExportOptionsUseCase } from '@modules/plugin/use-cases/listing-row/GetAnalysisListingExportOptionsUseCase';
import { GetListingRowsByAnalysisIdUseCase } from '@modules/plugin/use-cases/listing-row/GetListingRowsByAnalysisIdUseCase';
import { GetPluginListingDocumentsUseCase } from '@modules/plugin/use-cases/listing-row/GetPluginListingDocumentsUseCase';
import { GetSubListingUseCase } from '@modules/plugin/use-cases/listing-row/GetSubListingUseCase';

import type { ClonePluginInputDTO } from '@modules/plugin/dtos/plugin/ClonePluginDTO';
import type { CreatePluginInputDTO } from '@modules/plugin/dtos/plugin/CreatePluginDTO';
import type { DeleteBinaryInputDTO } from '@modules/plugin/dtos/plugin/DeleteBinaryDTO';
import type { DeletePluginByIdInputDTO } from '@modules/plugin/dtos/plugin/DeletePluginByIdDTO';
import type { DownloadPluginBinaryInputDTO } from '@modules/plugin/dtos/plugin/DownloadPluginBinaryDTO';
import type { ExecutePipelineInputDTO } from '@modules/plugin/dtos/plugin/ExecutePipelineDTO';
import type { ExportPluginInputDTO } from '@modules/plugin/dtos/plugin/ExportPluginDTO';
import type { GetPluginByIdInputDTO } from '@modules/plugin/dtos/plugin/GetPluginByIdDTO';
import type { ImportPluginInputDTO } from '@modules/plugin/dtos/plugin/ImportPluginDTO';
import type { ListPluginsInputDTO } from '@modules/plugin/dtos/plugin/ListPluginsDTO';
import type { RegistryInstallPluginInputDTO } from '@modules/plugin/dtos/plugin/RegistryInstallPluginDTO';
import type { SearchRegistryPluginsInputDTO } from '@modules/plugin/dtos/plugin/SearchRegistryPluginsDTO';
import type { UpdatePluginByIdInputDTO } from '@modules/plugin/dtos/plugin/UpdatePluginByIdDTO';
import type { CommitBinaryUploadInputDTO, UploadBinaryInputDTO } from '@modules/plugin/dtos/plugin/UploadBinaryDTO';
import type { ValidateWorkflowInputDTO } from '@modules/plugin/dtos/plugin/ValidateWorkflowDTO';

import type { GetPluginExposureChartInputDTO } from '@modules/plugin/dtos/exposure/GetPluginExposureChartDTO';
import type { GetPluginExposureExportInputDTO } from '@modules/plugin/dtos/exposure/GetPluginExposureExportDTO';
import type { GetPluginExposureGLBInputDTO } from '@modules/plugin/dtos/exposure/GetPluginExposureGLBDTO';

import type { GetAnalysisListingExportOptionsInputDTO } from '@modules/plugin/dtos/listing-row/GetAnalysisListingExportOptionsDTO';
import type {
    ExportListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdInputDTO
} from '@modules/plugin/dtos/listing-row/GetListingRowsByAnalysisIdDTO';
import type {
    ExportPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsInputDTO
} from '@modules/plugin/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { GetSubListingInputDTO } from '@modules/plugin/dtos/listing-row/GetSubListingDTO';

import { container } from 'tsyringe';

/**
 * The single HTTP-facing application service for the plugin module, `new`ed
 * directly by {@link PluginController} (pollium style — no DI decorator, no
 * `@inject` constructor, so it is trivially `new`-able). Replaces the former
 * `@Singleton` `PluginHttpService`.
 *
 * Each method is a thin delegator to a retained use case resolved once from the
 * DI container in a private field. The use cases (and the workflow / execution /
 * registry / storage / exposure / dependency-resolver services they depend on)
 * are kept intact: many are cross-consumed by the trajectory module via the
 * neutral `PLUGIN_USECASE_TOKENS.*` ports, by this module's AI tools and by the
 * debug socket module, and they carry the heavy plugin workflow/execution domain
 * logic. The use cases throw `ApplicationError`s directly (they propagate to
 * `httpErrorMiddleware` via Express 5 async forwarding — no Result channel).
 *
 * The download/export methods return the `DownloadStreamOutput` (stream +
 * headers + optional `prepare()`) that {@link PluginController} pipes to the
 * response, reproducing the previous `createPreparedDownloadStreamController`
 * behaviour.
 */
export default class PluginService {
    // Retained use cases resolved once from the container (registered at boot by
    // `autoloadModules`). The DI container is only touched here as a locator; the
    // use cases hold the actual collaborators (repository, workflow validator,
    // execution router, storage, registry gateway, exposure export service).
    #clonePluginUseCase = container.resolve(ClonePluginUseCase);
    #commitBinaryUploadUseCase = container.resolve(CommitBinaryUploadUseCase);
    #createPluginUseCase = container.resolve(CreatePluginUseCase);
    #deleteBinaryUseCase = container.resolve(DeleteBinaryUseCase);
    #deletePluginByIdUseCase = container.resolve(DeletePluginByIdUseCase);
    #downloadPluginBinaryUseCase = container.resolve(DownloadPluginBinaryUseCase);
    #executePipelineUseCase = container.resolve(ExecutePipelineUseCase);
    #exportPluginUseCase = container.resolve(ExportPluginUseCase);
    #getNodeTypesSchemaUseCase = container.resolve(GetNodeTypesSchemaUseCase);
    #getPluginByIdUseCase = container.resolve(GetPluginByIdUseCase);
    #importPluginUseCase = container.resolve(ImportPluginUseCase);
    #listPluginsUseCase = container.resolve(ListPluginsUseCase);
    #registryInstallPluginUseCase = container.resolve(RegistryInstallPluginUseCase);
    #searchRegistryPluginsUseCase = container.resolve(SearchRegistryPluginsUseCase);
    #updatePluginByIdUseCase = container.resolve(UpdatePluginByIdUseCase);
    #uploadBinaryUseCase = container.resolve(UploadBinaryUseCase);
    #validateWorkflowUseCase = container.resolve(ValidateWorkflowUseCase);
    #getPluginExposureChartUseCase = container.resolve(GetPluginExposureChartUseCase);
    #getPluginExposureExportUseCase = container.resolve(GetPluginExposureExportUseCase);
    #getPluginExposureGLBUseCase = container.resolve(GetPluginExposureGLBUseCase);
    #exportListingRowsByAnalysisIdUseCase = container.resolve(ExportListingRowsByAnalysisIdUseCase);
    #exportPluginListingDocumentsUseCase = container.resolve(ExportPluginListingDocumentsUseCase);
    #getAnalysisListingExportOptionsUseCase = container.resolve(GetAnalysisListingExportOptionsUseCase);
    #getListingRowsByAnalysisIdUseCase = container.resolve(GetListingRowsByAnalysisIdUseCase);
    #getPluginListingDocumentsUseCase = container.resolve(GetPluginListingDocumentsUseCase);
    #getSubListingUseCase = container.resolve(GetSubListingUseCase);

    // -- plugin ------------------------------------------------------------

    async getNodeTypesSchema() {
        return this.#getNodeTypesSchemaUseCase.execute();
    }

    async validateWorkflow(input: ValidateWorkflowInputDTO) {
        return this.#validateWorkflowUseCase.execute(input);
    }

    async exportPlugin(input: ExportPluginInputDTO) {
        return this.#exportPluginUseCase.execute(input);
    }

    async importPlugin(input: ImportPluginInputDTO) {
        return this.#importPluginUseCase.execute(input);
    }

    async searchRegistry(input: SearchRegistryPluginsInputDTO) {
        return this.#searchRegistryPluginsUseCase.execute(input);
    }

    async installRegistry(input: RegistryInstallPluginInputDTO) {
        return this.#registryInstallPluginUseCase.execute(input);
    }

    async listPlugins(input: ListPluginsInputDTO) {
        return this.#listPluginsUseCase.execute(input);
    }

    async createPlugin(input: CreatePluginInputDTO) {
        return this.#createPluginUseCase.execute(input);
    }

    async commitBinaryUpload(input: CommitBinaryUploadInputDTO) {
        return this.#commitBinaryUploadUseCase.execute(input);
    }

    async downloadBinary(input: DownloadPluginBinaryInputDTO) {
        return this.#downloadPluginBinaryUseCase.execute(input);
    }

    async uploadBinary(input: UploadBinaryInputDTO) {
        return this.#uploadBinaryUseCase.execute(input);
    }

    async deleteBinary(input: DeleteBinaryInputDTO) {
        return this.#deleteBinaryUseCase.execute(input);
    }

    async clonePlugin(input: ClonePluginInputDTO) {
        return this.#clonePluginUseCase.execute(input);
    }

    async getPluginById(input: GetPluginByIdInputDTO) {
        return this.#getPluginByIdUseCase.execute(input);
    }

    async updatePluginById(input: UpdatePluginByIdInputDTO) {
        return this.#updatePluginByIdUseCase.execute(input);
    }

    async deletePluginById(input: DeletePluginByIdInputDTO) {
        return this.#deletePluginByIdUseCase.execute(input);
    }

    async executePipeline(input: ExecutePipelineInputDTO) {
        return this.#executePipelineUseCase.execute(input);
    }

    // -- exposure ----------------------------------------------------------

    async getPluginExposureGLB(input: GetPluginExposureGLBInputDTO) {
        return this.#getPluginExposureGLBUseCase.execute(input);
    }

    async getPluginExposureChart(input: GetPluginExposureChartInputDTO) {
        return this.#getPluginExposureChartUseCase.execute(input);
    }

    async getPluginExposureExport(input: GetPluginExposureExportInputDTO) {
        return this.#getPluginExposureExportUseCase.execute(input);
    }

    // -- listing-row -------------------------------------------------------

    async getListingRowsByAnalysisId(input: GetListingRowsByAnalysisIdInputDTO) {
        return this.#getListingRowsByAnalysisIdUseCase.execute(input);
    }

    async getAnalysisListingExportOptions(input: GetAnalysisListingExportOptionsInputDTO) {
        return this.#getAnalysisListingExportOptionsUseCase.execute(input);
    }

    async exportListingRowsByAnalysisId(input: ExportListingRowsByAnalysisIdInputDTO) {
        return this.#exportListingRowsByAnalysisIdUseCase.execute(input);
    }

    async getSubListing(input: GetSubListingInputDTO) {
        return this.#getSubListingUseCase.execute(input);
    }

    async exportPluginListingDocuments(input: ExportPluginListingDocumentsInputDTO) {
        return this.#exportPluginListingDocumentsUseCase.execute(input);
    }

    async getPluginListingDocuments(input: GetPluginListingDocumentsInputDTO) {
        return this.#getPluginListingDocumentsUseCase.execute(input);
    }
}

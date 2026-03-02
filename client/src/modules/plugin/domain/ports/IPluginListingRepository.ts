import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO,
    ExportPluginListingInputDTO,
    ExportPluginListingOutputDTO,
    ExportListingByAnalysisInputDTO,
    ExportListingByAnalysisOutputDTO
} from '../../application/dtos';

export default interface IPluginListingRepository {
    getListing(params: GetPluginListingInputDTO): Promise<GetPluginListingOutputDTO>;
    exportListing(params: ExportPluginListingInputDTO): Promise<ExportPluginListingOutputDTO>;
    exportListingByAnalysis(params: ExportListingByAnalysisInputDTO): Promise<ExportListingByAnalysisOutputDTO>;
};

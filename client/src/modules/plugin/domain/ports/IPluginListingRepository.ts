import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO,
    ExportPluginListingInputDTO,
    ExportPluginListingOutputDTO,
    ExportListingByAnalysisInputDTO,
    ExportListingByAnalysisOutputDTO,
    GetSubListingInputDTO,
    GetSubListingOutputDTO
} from '../../application/dtos';

export default interface IPluginListingRepository {
    getListing(params: GetPluginListingInputDTO): Promise<GetPluginListingOutputDTO>;
    exportListing(params: ExportPluginListingInputDTO): Promise<ExportPluginListingOutputDTO>;
    exportListingByAnalysis(params: ExportListingByAnalysisInputDTO): Promise<ExportListingByAnalysisOutputDTO>;
    getSubListing(params: GetSubListingInputDTO): Promise<GetSubListingOutputDTO>;
};

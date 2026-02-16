import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO,
    ExportPluginListingInputDTO,
    ExportPluginListingOutputDTO
} from '../../application/dtos';

export default interface IPluginListingRepository {
    getListing(params: GetPluginListingInputDTO): Promise<GetPluginListingOutputDTO>;
    exportListing(params: ExportPluginListingInputDTO): Promise<ExportPluginListingOutputDTO>;
};

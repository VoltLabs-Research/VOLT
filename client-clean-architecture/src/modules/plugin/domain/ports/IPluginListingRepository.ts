import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO
} from '../../application/dtos';

export default interface IPluginListingRepository {
    getListing(params: GetPluginListingInputDTO): Promise<GetPluginListingOutputDTO>;
};

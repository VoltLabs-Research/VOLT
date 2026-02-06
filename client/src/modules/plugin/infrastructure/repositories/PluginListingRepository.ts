import { injectable } from 'tsyringe';
import BaseRepository from '@/shared/infrastructure/repositories/BaseRepository';
import type IPluginListingRepository from '../../domain/ports/IPluginListingRepository';
import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO
} from '../../application/dtos';

@injectable()
export default class PluginListingRepository extends BaseRepository implements IPluginListingRepository {
    constructor() {
        super('/plugin', { useRBAC: true });
    }

    async getListing(params: GetPluginListingInputDTO): Promise<GetPluginListingOutputDTO> {
        const { pluginSlug, listingSlug, trajectoryId, limit, page } = params;

        const path = trajectoryId
            ? `/listing/${pluginSlug}/${listingSlug}/${trajectoryId}`
            : `/listing/${pluginSlug}/${listingSlug}`;

        const query: Record<string, unknown> = {};

        if (limit) {
            query.limit = limit;
        }

        if (page) {
            query.page = page;
        }

        return this.client.get<GetPluginListingOutputDTO>(path, query);
    }
};

import { injectable } from 'tsyringe';
import BaseRepository, { type RawPaginatedResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IPluginListingRepository from '../../domain/ports/IPluginListingRepository';
import type { ListingRow } from '../../domain/entities';
import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO,
    ExportPluginListingInputDTO,
    ExportPluginListingOutputDTO
} from '../../application/dtos';

@injectable()
export default class PluginListingRepository extends BaseRepository implements IPluginListingRepository {
    constructor() {
        super('/plugin', { useRBAC: true });
    }

    async getListing(params: GetPluginListingInputDTO): Promise<GetPluginListingOutputDTO> {
        const { pluginSlug, listingSlug, exposureId, trajectoryId, analysisId, limit, page } = params;

        if (!exposureId && !listingSlug) {
            throw new Error('Exposure::IdRequired');
        }

        const path = exposureId
            ? (trajectoryId
                ? `/listing/${pluginSlug}/exposure/${exposureId}/${trajectoryId}`
                : `/listing/${pluginSlug}/exposure/${exposureId}`)
            : (trajectoryId
                ? `/listing/${pluginSlug}/${listingSlug}/${trajectoryId}`
                : `/listing/${pluginSlug}/${listingSlug}`);

        const query: Record<string, unknown> = {};

        if (limit) {
            query.limit = limit;
        }

        if (page) {
            query.page = page;
        }

        if (analysisId) {
            query.analysisId = analysisId;
        }

        if (listingSlug) {
            query.listingSlug = listingSlug;
        }

        // The server wraps the result via BaseResponse.success(), producing
        // { status, data: { data: rows[], total, page, totalPages, limit, _meta } }.
        // VoltClient.get() returns this raw envelope. We need to unwrap the
        // nested pagination and hoist _meta so the client gets a flat
        // PaginatedResponse<ListingRow> with _meta attached.
        const raw = await this.client.get<RawPaginatedResponse<ListingRow>>(path, query);
        const unwrapped = this.unwrapPaginated(raw);

        // _meta lives inside the nested data object on the server response;
        // unwrapPaginated doesn't extract it, so we hoist it manually.
        const inner = raw.data as Record<string, unknown>;
        if (inner._meta) {
            unwrapped._meta = inner._meta as GetPluginListingOutputDTO['_meta'];
        }

        return unwrapped as GetPluginListingOutputDTO;
    }

    async exportListing(params: ExportPluginListingInputDTO): Promise<ExportPluginListingOutputDTO> {
        const { pluginSlug, exposureId, trajectoryId, analysisId, listingSlug } = params;

        if (!exposureId) {
            throw new Error('Exposure::IdRequired');
        }

        const path = trajectoryId
            ? `/listing/${pluginSlug}/exposure/${exposureId}/${trajectoryId}/export`
            : `/listing/${pluginSlug}/exposure/${exposureId}/export`;

        const query: Record<string, unknown> = {};

        if (analysisId) {
            query.analysisId = analysisId;
        }

        if (listingSlug) {
            query.listingSlug = listingSlug;
        }

        const response = await this.client.get<{ status: string; data: ExportPluginListingOutputDTO }>(path, query);

        return response.data;
    }
};

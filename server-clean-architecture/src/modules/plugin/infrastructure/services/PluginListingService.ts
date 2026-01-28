import { injectable, inject } from 'tsyringe';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import ListingRow from '@modules/plugin/domain/entities/ListingRow';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

interface ListingOptions {
    teamId?: string;
    trajectoryId?: string;
    limit?: number;
    sortAsc?: boolean;
    afterCursor?: string;
}

const RESERVED_KEYS = new Set([
    '_id',
    'timestep',
    'analysisId',
    'trajectoryId',
    'exposureId',
    'trajectoryName'
]);

@injectable()
export class PluginListingService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.ListingRowRepository) private listingRowRepository: IListingRowRepository
    ) {}

    async getListingDocuments(pluginSlug: string, listingSlug: string, options: ListingOptions): Promise<any> {
        const limit = Math.min(200, Math.max(1, options.limit || 50));
        const sortAsc = options.sortAsc || false;

        // Parse cursor
        let afterTimestep: number | null = null;
        let afterId: string | null = null;

        if (options.afterCursor?.includes(':')) {
            const [timestep, id] = options.afterCursor.split(':');
            afterTimestep = Number(timestep);
            afterId = id;
        }

        // Find plugin by slug
        const plugin = await this.pluginRepository.findOne({ slug: pluginSlug });
        if (!plugin) {
            throw new Error('Plugin::NotFound');
        }

        // Build base query
        const baseQuery: any = {
            plugin: plugin.id,
            listingSlug,
            team: options.teamId
        };

        if (options.trajectoryId) {
            baseQuery.trajectory = options.trajectoryId;
        } else if (!options.teamId) {
            throw new Error('Team::IdRequired');
        }

        // Add cursor-based pagination
        if (afterTimestep != null && afterId) {
            baseQuery.$or = sortAsc
                ? [
                    { timestep: { $gt: afterTimestep } },
                    { timestep: afterTimestep, _id: { $gt: afterId } }
                ]
                : [
                    { timestep: { $lt: afterTimestep } },
                    { timestep: afterTimestep, _id: { $lt: afterId } }
                ];
        }

        // Query database with trajectory populate for name fallback
        const result = await this.listingRowRepository.findAll({
            filter: baseQuery,
            limit: limit + 1,
            page: 1,
            sort: { 
                timestep: sortAsc ? 1 : -1, 
                _id: sortAsc ? 1 : -1 
            },
            populate: 'trajectory'
        });

        const docs = result.data;
        const hasMore = docs.length > limit;
        const slice = hasMore ? docs.slice(0, limit) : docs;

        // Transform to raw rows
        const rawRows = slice.map((doc: ListingRow) => {
            const trajectory = doc.props.trajectory as any;
            return {
                _id: doc.id,
                timestep: doc.props.timestep,
                analysisId: doc.props.analysis,
                trajectoryId: trajectory?._id ?? trajectory,
                exposureId: doc.props.exposureId,
                trajectoryName: trajectory?.name ?? '',
                ...(doc.props.row || {})
            };
        });

        // Reorder fields to have reserved keys first
        const rows = rawRows.map((r: any) => {
            const fixed: Record<string, any> = {
                _id: r._id,
                timestep: r.timestep,
                analysisId: r.analysisId,
                trajectoryId: r.trajectoryId,
                exposureId: r.exposureId,
                trajectoryName: r.trajectoryName
            };

            const rest = { ...r };
            for (const k of Object.keys(fixed)) delete rest[k];

            return { ...fixed, ...rest };
        });

        // Extract column metadata
        const seen = new Set<string>();
        const ordered: string[] = [];
        const nonNull = new Set<string>();

        for (const r of rows) {
            for (const [k, v] of Object.entries(r)) {
                if (RESERVED_KEYS.has(k)) continue;
                if (v === null || v === undefined) continue;
                nonNull.add(k);
                if (!seen.has(k)) {
                    seen.add(k);
                    ordered.push(k);
                }
            }
        }

        const columns = ordered
            .filter((k) => nonNull.has(k))
            .map((k) => ({ path: k, label: k }));

        const nextCursor = hasMore && slice.length > 0
            ? `${slice[slice.length - 1].props.timestep}:${slice[slice.length - 1].id}`
            : null;

        return {
            meta: { pluginSlug, listingSlug, columns },
            rows,
            limit,
            hasMore,
            nextCursor
        };
    }
}

import { injectable, inject } from 'tsyringe';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import ListingRow from '@modules/plugin/domain/entities/ListingRow';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';

interface ListingOptions {
    teamId?: string;
    trajectoryId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
};

interface ColumnConfig {
    key: string;
    title: string;
    sortable: boolean;
};

interface ListingRowData {
    _id: string;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    exposureId: string;
    trajectoryName: string;
    [key: string]: unknown;
};

export interface PluginListingPaginatedResult {
    data: ListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta: {
        pluginSlug: string;
        listingSlug: string;
        columns: ColumnConfig[];
    };
};

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

    async getListingDocuments(pluginSlug: string, listingSlug: string, options: ListingOptions): Promise<PluginListingPaginatedResult> {
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(200, Math.max(1, options.limit || 50));
        const sortAsc = options.sortAsc || false;

        // Find plugin by slug
        const plugin = await this.pluginRepository.findOne({ slug: pluginSlug });
        if (!plugin) {
            throw new Error('Plugin::NotFound');
        }

        // Build base query
        const baseQuery: Record<string, unknown> = {
            plugin: plugin.id,
            listingSlug,
            team: options.teamId
        };

        if (options.trajectoryId) {
            baseQuery.trajectory = options.trajectoryId;
        } else if (!options.teamId) {
            throw new Error('Team::IdRequired');
        }

        // Query database with pagination
        const result: PaginatedResult<ListingRow> = await this.listingRowRepository.findAll({
            filter: baseQuery as any,
            limit,
            page,
            sort: {
                timestep: sortAsc ? 1 : -1,
                _id: sortAsc ? 1 : -1
            },
            populate: 'trajectory'
        });

        // Transform to raw rows
        const rawRows = result.data.map((doc: ListingRow) => {
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
            const fixed: Record<string, unknown> = {
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

        const columns: ColumnConfig[] = ordered
            .filter((k) => nonNull.has(k))
            .map((k) => ({ key: k, title: k, sortable: true }));

        return {
            data: rows,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            limit: result.limit,
            _meta: {
                pluginSlug,
                listingSlug,
                columns
            }
        };
    }
};

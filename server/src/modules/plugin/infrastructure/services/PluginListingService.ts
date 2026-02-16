import { injectable, inject } from 'tsyringe';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import ListingRow from '@modules/plugin/domain/entities/ListingRow';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

interface ListingOptions {
    teamId?: string;
    trajectoryId?: string;
    analysisId?: string;
    listingSlug?: string;
    exposureId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
};

interface ColumnConfig {
    path: string;
    label: string;
    sortable: boolean;
    width?: number;
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
        exposureId: string;
        columns: ColumnConfig[];
    };
};

@injectable()
export class PluginListingService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.ListingRowRepository) private listingRowRepository: IListingRowRepository
    ) {}

    async getListingDocuments(pluginSlug: string, options: ListingOptions): Promise<PluginListingPaginatedResult> {
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(200, Math.max(1, options.limit || 50));
        const sortAsc = options.sortAsc || false;

        if (!options.exposureId && !options.listingSlug) {
            throw new Error('Exposure::SelectorRequired');
        }

        // Find plugin by slug
        const plugin = await this.pluginRepository.findOne({ slug: pluginSlug });
        if (!plugin) {
            throw new Error('Plugin::NotFound');
        }

        const exposureDescriptor = this.resolveListingExposure(plugin, options.exposureId, options.listingSlug);
        if (!exposureDescriptor) {
            throw new Error('Exposure::NotFound');
        }

        const { exposureId, listingSlug, columns } = exposureDescriptor;

        // Build base query
        const baseQuery: Record<string, unknown> = {
            plugin: plugin.id,
            exposureId,
            team: options.teamId
        };

        if (listingSlug) {
            baseQuery.listingSlug = listingSlug;
        }

        if (options.trajectoryId) {
            baseQuery.trajectory = options.trajectoryId;
        } else if (!options.teamId) {
            throw new Error('Team::IdRequired');
        }

        if (options.analysisId) {
            baseQuery.analysis = options.analysisId;
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

        return {
            data: rows,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            limit: result.limit,
            _meta: {
                pluginSlug,
                listingSlug,
                exposureId,
                columns
            }
        };
    }

    private resolveListingExposure(
        plugin: any,
        exposureId?: string,
        listingSlug?: string
    ): { exposureId: string; listingSlug: string; columns: ColumnConfig[] } | null {
        const workflow = plugin?.props?.workflow;
        const nodes = workflow?.props?.nodes || [];
        const edges = workflow?.props?.edges || [];

        const exposures = nodes.filter((node: any) => node?.type === WorkflowNodeType.Exposure);
        for (const exposureNode of exposures) {
            const id = String(exposureNode?.id || '');
            const name = String(exposureNode?.data?.exposure?.name || '').trim();
            if (!id || !name) continue;

            if (exposureId && id !== exposureId) continue;
            if (!exposureId && listingSlug && name !== listingSlug) continue;

            const columns = this.findColumnsForExposure(id, nodes, edges);
            if (!columns.length) {
                continue;
            }

            return {
                exposureId: id,
                listingSlug: name,
                columns
            };
        }

        return null;
    }

    private findColumnsForExposure(exposureId: string, nodes: any[], edges: any[]): ColumnConfig[] {
        const visited = new Set<string>();
        const queue = [exposureId];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const outgoing = edges.filter((edge: any) => edge.source === current);
            for (const edge of outgoing) {
                const target = nodes.find((node: any) => node.id === edge.target);
                if (!target) continue;

                if (target.type === WorkflowNodeType.Visualizers) {
                    const listing = target?.data?.visualizers?.listing;
                    if (!listing || typeof listing !== 'object' || Object.keys(listing).length === 0) {
                        continue;
                    }

                    return Object.entries(listing).map(([, label]) => ({
                        path: String(label),
                        label: String(label),
                        sortable: true
                    }));
                }

                queue.push(target.id);
            }
        }

        return [];
    }
};

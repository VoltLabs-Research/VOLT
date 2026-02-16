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

interface ListingPreparedContext {
    pluginSlug: string;
    exposureId: string;
    listingSlug: string;
    columns: ColumnConfig[];
    baseQuery: Record<string, unknown>;
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

export interface PluginListingExportResult {
    meta: {
        pluginSlug: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        total: number;
    };
    data: ListingRowData[];
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
        const prepared = await this.prepareListingContext(pluginSlug, options);

        // Query database with pagination
        const result: PaginatedResult<ListingRow> = await this.listingRowRepository.findAll({
            filter: prepared.baseQuery as any,
            limit,
            page,
            sort: {
                timestep: sortAsc ? 1 : -1,
                _id: sortAsc ? 1 : -1
            },
            populate: 'trajectory'
        });

        // Transform to raw rows
        const rows = this.toListingRows(result.data);

        return {
            data: rows,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            limit: result.limit,
            _meta: {
                pluginSlug: prepared.pluginSlug,
                listingSlug: prepared.listingSlug,
                exposureId: prepared.exposureId,
                columns: prepared.columns
            }
        };
    }

    async exportListingDocuments(pluginSlug: string, options: ListingOptions): Promise<PluginListingExportResult> {
        const sortAsc = options.sortAsc || false;
        const pageSize = 200;
        const prepared = await this.prepareListingContext(pluginSlug, options);

        let page = 1;
        let totalPages = 1;
        let total = 0;
        const rows: ListingRowData[] = [];

        do {
            const pageResult = await this.listingRowRepository.findAll({
                filter: prepared.baseQuery as any,
                limit: pageSize,
                page,
                sort: {
                    timestep: sortAsc ? 1 : -1,
                    _id: sortAsc ? 1 : -1
                },
                populate: 'trajectory'
            });

            total = pageResult.total;
            totalPages = Math.max(1, pageResult.totalPages || 1);
            rows.push(...this.toListingRows(pageResult.data));
            page += 1;
        } while (page <= totalPages);

        return {
            meta: {
                pluginSlug: prepared.pluginSlug,
                exposureId: prepared.exposureId,
                analysisId: options.analysisId,
                trajectoryId: options.trajectoryId,
                total
            },
            data: rows
        };
    }

    private async prepareListingContext(pluginSlug: string, options: ListingOptions): Promise<ListingPreparedContext> {
        if (!options.exposureId && !options.listingSlug) {
            throw new Error('Exposure::SelectorRequired');
        }

        const plugin = await this.pluginRepository.findOne({ slug: pluginSlug });
        if (!plugin) {
            throw new Error('Plugin::NotFound');
        }

        const exposureDescriptor = this.resolveListingExposure(plugin, options.exposureId, options.listingSlug);
        if (!exposureDescriptor) {
            throw new Error('Exposure::NotFound');
        }

        const { exposureId, listingSlug, columns } = exposureDescriptor;
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

        return {
            pluginSlug,
            exposureId,
            listingSlug,
            columns,
            baseQuery
        };
    }

    private toListingRows(documents: ListingRow[]): ListingRowData[] {
        const rawRows = documents.map((doc: ListingRow) => {
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

        return rawRows.map((row: any) => {
            const fixed: Record<string, unknown> = {
                _id: row._id,
                timestep: row.timestep,
                analysisId: row.analysisId,
                trajectoryId: row.trajectoryId,
                exposureId: row.exposureId,
                trajectoryName: row.trajectoryName
            };

            const rest = { ...row };
            for (const key of Object.keys(fixed)) {
                delete rest[key];
            }

            return { ...fixed, ...rest } as ListingRowData;
        });
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

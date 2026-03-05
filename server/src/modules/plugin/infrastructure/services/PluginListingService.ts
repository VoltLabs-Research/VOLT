import { injectable, inject } from 'tsyringe';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import ListingRow from '@modules/plugin/domain/entities/ListingRow';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ExportType, PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

interface ListingOptions {
    teamId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureName?: string;
    exposureId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
    format?: ExportType;
}

interface ListingPreparedContext {
    pluginId: string;
    exposureId: string;
    exposureName: string;
    baseQuery: Record<string, unknown>;
}

interface ColumnConfig {
    label: string;
    sortable: boolean;
    width?: number;
}

interface ListingRowData {
    _id: string;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    exposureId: string;
    trajectoryName: string;
    [key: string]: unknown;
}

export interface PluginListingPaginatedResult {
    data: ListingRowData[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta: {
        pluginId: string;
        exposureName: string;
        exposureId: string;
        columns: ColumnConfig[];
        subListingNames: string[];
    };
}

export interface PluginListingExportResult {
    meta: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        total: number;
        columns: ColumnConfig[];
        format: ExportType;
    };
    data: ListingRowData[];
}

const SYSTEM_KEYS = new Set([
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

    async getListingDocuments(pluginId: string, options: ListingOptions): Promise<PluginListingPaginatedResult> {
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(200, Math.max(1, options.limit || 50));
        const sortAsc = options.sortAsc || false;
        const prepared = await this.prepareListingContext(pluginId, options);

        const result: PaginatedResult<ListingRow> = await this.listingRowRepository.findAll({
            filter: prepared.baseQuery as Record<string, unknown>,
            limit,
            page,
            sort: {
                timestep: sortAsc ? 1 : -1,
                _id: sortAsc ? 1 : -1
            },
            populate: 'trajectory'
        });

        const rows = this.toListingRows(result.data);
        const columns = this.deriveColumns(rows);
        const subListingNames = this.discoverSubListingNames(result.data);

        return {
            data: rows,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            limit: result.limit,
            _meta: {
                pluginId: prepared.pluginId,
                exposureName: prepared.exposureName,
                exposureId: prepared.exposureId,
                columns,
                subListingNames
            }
        };
    }

    async exportListingDocuments(pluginId: string, options: ListingOptions): Promise<PluginListingExportResult> {
        const sortAsc = options.sortAsc || false;
        const format = options.format || 'json';
        const pageSize = 200;
        const prepared = await this.prepareListingContext(pluginId, options);

        let page = 1;
        let totalPages = 1;
        let total = 0;
        const rows: ListingRowData[] = [];

        do {
            const pageResult = await this.listingRowRepository.findAll({
                filter: prepared.baseQuery as Record<string, unknown>,
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

        const columns = this.deriveColumns(rows);

        return {
            meta: {
                pluginId: prepared.pluginId,
                exposureId: prepared.exposureId,
                analysisId: options.analysisId,
                trajectoryId: options.trajectoryId,
                total,
                columns,
                format
            },
            data: rows
        };
    }

    private async prepareListingContext(pluginId: string, options: ListingOptions): Promise<ListingPreparedContext> {
        if (!options.exposureId && !options.exposureName) {
            throw new Error('Exposure::SelectorRequired');
        }

        const plugin = await this.pluginRepository.findById(pluginId);
        if (!plugin) {
            throw new Error('Plugin::NotFound');
        }

        const exposure = this.findExposure(plugin, options.exposureId, options.exposureName);
        if (!exposure) {
            throw new Error('Exposure::NotFound');
        }

        const baseQuery: Record<string, unknown> = {
            plugin: plugin.id,
            exposureId: exposure.exposureId,
            team: options.teamId
        };

        if (exposure.exposureName) {
            baseQuery.exposureName = exposure.exposureName;
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
            pluginId,
            exposureId: exposure.exposureId,
            exposureName: exposure.exposureName,
            baseQuery
        };
    }

    private findExposure(
        plugin: Record<string, any>,
        exposureId?: string,
        exposureName?: string
    ): { exposureId: string; exposureName: string } | null {
        const nodes = plugin?.props?.workflow?.props?.nodes || [];

        for (const node of nodes) {
            if (node.type !== WorkflowNodeType.Exposure) continue;

            const nodeId = String(node.id || '');
            const nodeName = String(node.data?.exposure?.name || '').trim();
            if (!nodeId || !nodeName) continue;

            if (exposureId && nodeId !== exposureId) continue;
            if (!exposureId && exposureName && nodeName !== exposureName) continue;

            return {
                exposureId: nodeId,
                exposureName: nodeName
            };
        }

        return null;
    }

    private toListingRows(documents: ListingRow[]): ListingRowData[] {
        return documents.map((document) => {
            const trajectory = document.props.trajectory as Record<string, unknown> | string;
            const trajectoryId = (typeof trajectory === 'object' && trajectory !== null)
                ? String((trajectory as Record<string, unknown>)._id ?? '')
                : String(trajectory ?? '');
            const trajectoryName = (typeof trajectory === 'object' && trajectory !== null)
                ? String((trajectory as Record<string, unknown>).name ?? '')
                : '';

            return {
                _id: document.id,
                timestep: document.props.timestep,
                analysisId: document.props.analysis,
                trajectoryId,
                exposureId: document.props.exposureId,
                trajectoryName,
                ...(document.props.row || {})
            };
        });
    }

    private discoverSubListingNames(documents: ListingRow[]): string[] {
        for (const document of documents) {
            const names = document.props.subListingNames;
            if (names && names.length > 0) {
                return names;
            }
        }
        return [];
    }

    private deriveColumns(rows: ListingRowData[]): ColumnConfig[] {
        const columnLabels = new Set<string>();

        for (const row of rows) {
            for (const key of Object.keys(row)) {
                if (!SYSTEM_KEYS.has(key)) {
                    columnLabels.add(key);
                }
            }
        }

        return Array.from(columnLabels)
            .sort((a, b) => a.localeCompare(b))
            .map((label) => ({
                label,
                sortable: true
            }));
    }
}

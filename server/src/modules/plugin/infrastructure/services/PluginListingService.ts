import { injectable, inject } from 'tsyringe';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import ListingRow from '@modules/plugin/domain/entities/ListingRow';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ExportType, PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { parseSchemaAnnotations, ListingField } from '@modules/plugin/infrastructure/utilities/schema-annotations';

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
};

interface ListingPreparedContext {
    pluginId: string;
    exposureId: string;
    exposureName: string;
    columns: ColumnConfig[];
    baseQuery: Record<string, unknown>;
};

interface ColumnConfig {
    path: string;
    label: string;
    sortable: boolean;
    width?: number;
    sourcePath?: string;
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
        pluginId: string;
        exposureName: string;
        exposureId: string;
        columns: ColumnConfig[];
    };
};

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
};

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
        const columns = this.materializeColumns(prepared.columns, rows);

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
                columns
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

        const columns = this.materializeColumns(prepared.columns, rows);

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

        const exposureDescriptor = this.resolveListingExposure(plugin, options.exposureId, options.exposureName);
        if (!exposureDescriptor) {
            throw new Error('Exposure::NotFound');
        }

        const { exposureId, exposureName, columns } = exposureDescriptor;
        const baseQuery: Record<string, unknown> = {
            plugin: plugin.id,
            exposureId,
            team: options.teamId
        };

        if (exposureName) {
            baseQuery.exposureName = exposureName;
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
            exposureId,
            exposureName,
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
        exposureName?: string
    ): { exposureId: string; exposureName: string; columns: ColumnConfig[] } | null {
        const workflow = plugin?.props?.workflow;
        const nodes = workflow?.props?.nodes || [];
        const edges = workflow?.props?.edges || [];

        const exposures = nodes.filter((node: any) => node?.type === WorkflowNodeType.Exposure);
        for (const exposureNode of exposures) {
            const id = String(exposureNode?.id || '');
            const name = String(exposureNode?.data?.exposure?.name || '').trim();
            if (!id || !name) continue;

            if (exposureId && id !== exposureId) continue;
            if (!exposureId && exposureName && name !== exposureName) continue;

            const columns = this.findColumnsForExposure(id, nodes, edges);
            if (!columns.length) {
                continue;
            }

            return {
                exposureId: id,
                exposureName: name,
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

                if (target.type === WorkflowNodeType.Schema) {
                    const definition = target?.data?.schema?.definition;
                    if (!definition || typeof definition !== 'object') continue;

                    const annotations = parseSchemaAnnotations(definition as Record<string, unknown>);
                    if (annotations.listingFields.length === 0) continue;

                    return this.buildColumnConfigsFromAnnotations(target.id, annotations.listingFields);
                }

                queue.push(target.id);
            }
        }

        return [];
    }

    private buildColumnConfigsFromAnnotations(schemaNodeId: string, listingFields: ListingField[]): ColumnConfig[] {
        const columns: ColumnConfig[] = [];

        for (const field of listingFields) {
            if (field.kind === 'primitive') {
                columns.push({
                    path: field.label,
                    label: field.label,
                    sortable: true,
                    sourcePath: `{{ ${schemaNodeId}.definition.${field.path} }}`
                });
            }

            if (field.kind === 'array' && field.labels) {
                for (let i = 0; i < field.labels.length; i++) {
                    const columnLabel = `${field.label} ${field.labels[i]}`;
                    columns.push({
                        path: columnLabel,
                        label: columnLabel,
                        sortable: true,
                        sourcePath: `{{ ${schemaNodeId}.definition.${field.path}.${i} }}`
                    });
                }
            }

            if (field.kind === 'object') {
                columns.push({
                    path: 'auto',
                    label: 'auto',
                    sortable: true,
                    sourcePath: `{{ ${schemaNodeId}.definition.${field.path}.* }}`
                });
            }
        }

        return columns;
    }

    private isAutoWildcardColumn(column: ColumnConfig): boolean {
        const label = String(column.label || '').trim().toLowerCase();
        const sourcePath = String(column.sourcePath || '');
        return label === 'auto' && sourcePath.includes('*');
    }

    private materializeColumns(configuredColumns: ColumnConfig[], rows: ListingRowData[]): ColumnConfig[] {
        const staticLabels = new Set(
            configuredColumns
                .filter((column) => !this.isAutoWildcardColumn(column))
                .map((column) => String(column.label || '').trim())
                .filter(Boolean)
        );

        const systemKeys = new Set([
            '_id',
            'timestep',
            'analysisId',
            'trajectoryId',
            'exposureId',
            'trajectoryName',
            ...Array.from(staticLabels)
        ]);

        const dynamicAutoLabels = new Set<string>();
        for (const row of rows) {
            for (const key of Object.keys(row)) {
                if (!systemKeys.has(key)) {
                    dynamicAutoLabels.add(key);
                }
            }
        }

        const orderedDynamicLabels = Array.from(dynamicAutoLabels).sort((a, b) => a.localeCompare(b));
        const columns: ColumnConfig[] = [];

        for (const column of configuredColumns) {
            if (this.isAutoWildcardColumn(column)) {
                for (const dynamicLabel of orderedDynamicLabels) {
                    columns.push({
                        path: dynamicLabel,
                        label: dynamicLabel,
                        sortable: true
                    });
                }
                continue;
            }

            const label = String(column.label || '').trim();
            if (!label) continue;

            columns.push({
                path: label,
                label,
                sortable: Boolean(column.sortable),
                width: column.width
            });
        }

        const seen = new Set<string>();
        return columns.filter((column) => {
            const key = String(column.label || '').trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
};

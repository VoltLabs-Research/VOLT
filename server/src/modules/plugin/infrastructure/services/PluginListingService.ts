import { injectable, inject } from 'tsyringe';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/port/IListingRowRepository';
import ListingRow from '@modules/plugin/domain/entities/ListingRow';
import Plugin from '@modules/plugin/domain/entities/Plugin';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { getExposureNodes } from '@modules/plugin/infrastructure/utilities/get-exposure-nodes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    ColumnConfig,
    ListingOptions,
    PluginListingExportResult,
    PluginListingPaginatedResult,
    PluginListingRowData as ListingRowData
} from '@modules/plugin/domain/port/PluginListingTypes';

interface ListingPreparedContext {
    pluginId: string;
    exposureId: string;
    exposureName: string;
    baseQuery: Record<string, unknown>;
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
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'Either exposureId or exposureName is required'
            );
        }

        const plugin = await this.pluginRepository.findById(pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const exposure = this.findExposure(plugin, options.exposureId, options.exposureName);
        if (!exposure) {
            const exposureSelector = options.exposureId || options.exposureName || 'unknown';

            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                `Exposure not found for selector: ${exposureSelector}`
            );
        }

        const baseQuery: Record<string, unknown> = {
            plugin: plugin._id,
            exposureId: exposure.exposureId,
            team: options.teamId
        };

        if (exposure.exposureName) {
            baseQuery.exposureName = exposure.exposureName;
        }

        if (options.trajectoryId) {
            baseQuery.trajectory = options.trajectoryId;
        } else if (!options.teamId) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_ID_REQUIRED,
                'Team ID is required when trajectoryId is not provided'
            );
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
        plugin: Plugin,
        exposureId?: string,
        exposureName?: string
    ): { exposureId: string; exposureName: string } | null {
        const nodes = plugin.props.workflow.props.nodes;
        const exposures = getExposureNodes(nodes as WorkflowNode[]);

        for (const exposure of exposures) {
            if (exposureId && exposure.exposureId !== exposureId) continue;
            if (!exposureId && exposureName && exposure.exposureName !== exposureName) continue;

            return {
                exposureId: exposure.exposureId,
                exposureName: exposure.exposureName
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
                _id: document._id,
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

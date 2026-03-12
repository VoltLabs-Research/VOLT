import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import {
    ColumnConfig,
    ListingOptions,
    PluginListingExportResult,
    PluginListingPaginatedResult,
    PluginListingRowData
} from '@modules/plugin/domain/contracts/listing-row/PluginListing';
import { ErrorCodes } from '@core/constants/error-codes';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { getExposureNodes } from '@modules/plugin/utilities/exposure/get-exposure-nodes';
import { WorkflowNode } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { injectable, inject } from 'tsyringe';
import { mapDaemonRow } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';
import type { DaemonListingRow, DaemonPaginatedResult } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';
import type { IPluginListingExportService } from '@modules/plugin/domain/port/listing-row/IPluginListingExportService';
import type { IPluginListingService } from '@modules/plugin/domain/port/listing-row/IPluginListingService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

const DAEMON_PAGE_SIZE = 200;
const SYSTEM_KEYS = new Set(['_id', 'timestep', 'analysisId', 'trajectoryId', 'exposureId', 'trajectoryName']);

interface ResolvedContext {
    teamClusterId: string;
    analysisId: string;
}

@injectable()
export class DaemonPluginListingService implements IPluginListingService, IPluginListingExportService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly daemonClient: TeamClusterDaemonClient
    ) {}

    async getListingDocuments(pluginId: string, options: ListingOptions): Promise<PluginListingPaginatedResult> {
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(200, Math.max(1, options.limit || 50));
        const sortAsc = options.sortAsc ?? false;

        const resolved = await this.resolveContext(pluginId, options);
        if (!resolved) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'No analysis with team cluster found for the given criteria'
            );
        }

        const daemonResult = await this.daemonClient.command<DaemonPaginatedResult>(
            resolved.teamClusterId,
            'plugin.listings.list',
            {
                pluginId,
                teamId: options.teamId,
                analysisId: resolved.analysisId,
                trajectoryId: options.trajectoryId,
                exposureId: options.exposureId,
                exposureName: options.exposureName,
                page,
                limit
            }
        );

        const rows = (daemonResult.data || []).map(mapDaemonRow);
        const columns = this.deriveColumns(rows);
        const subListingNames = this.discoverSubListingNames(daemonResult.data || []);
        const exposure = this.findExposure(await this.pluginRepository.findById(pluginId), options.exposureId, options.exposureName);

        return {
            data: rows,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit,
            _meta: {
                pluginId,
                exposureId: exposure?.exposureId || options.exposureId || '',
                exposureName: exposure?.exposureName || options.exposureName || '',
                columns,
                subListingNames
            }
        };
    }

    async exportListingDocuments(pluginId: string, options: ListingOptions): Promise<PluginListingExportResult> {
        const format = options.format ?? ExportType.Json;

        const resolved = await this.resolveContext(pluginId, options);
        if (!resolved) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'No analysis with team cluster found for the given criteria'
            );
        }

        const allRows: DaemonListingRow[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
            const result = await this.daemonClient.command<DaemonPaginatedResult>(
                resolved.teamClusterId,
                'plugin.listings.list',
                {
                    pluginId,
                    teamId: options.teamId,
                    analysisId: resolved.analysisId,
                    trajectoryId: options.trajectoryId,
                    exposureId: options.exposureId,
                    exposureName: options.exposureName,
                    page: currentPage,
                    limit: DAEMON_PAGE_SIZE
                }
            );

            allRows.push(...(result.data || []));
            totalPages = result.totalPages || 1;
            currentPage++;
        } while (currentPage <= totalPages);

        const rows: PluginListingRowData[] = allRows.map(mapDaemonRow);
        const columns = this.deriveColumns(rows);
        const exposure = this.findExposure(await this.pluginRepository.findById(pluginId), options.exposureId, options.exposureName);

        return {
            meta: {
                pluginId,
                exposureId: exposure?.exposureId || options.exposureId || '',
                analysisId: options.analysisId,
                trajectoryId: options.trajectoryId,
                total: rows.length,
                columns,
                format
            },
            data: rows
        };
    }

    private toTeamClusterId(teamCluster: string | { _id?: string } | null | undefined): string | null {
        if (!teamCluster) return null;
        return typeof teamCluster === 'string' ? teamCluster : String(teamCluster._id ?? '');
    }

    private async resolveContext(pluginId: string, options: ListingOptions): Promise<ResolvedContext | null> {
        if (options.analysisId) {
            const analysis = await this.analysisRepository.findById(options.analysisId);
            const teamClusterId = this.toTeamClusterId(analysis?.props.teamCluster);
            if (teamClusterId) {
                return { teamClusterId, analysisId: options.analysisId };
            }
        }

        const filter: Record<string, unknown> = {
            plugin: pluginId,
            teamCluster: { $exists: true, $ne: null }
        };
        if (options.trajectoryId) filter.trajectory = options.trajectoryId;
        if (options.teamId) filter.team = options.teamId;

        const analysis = await this.analysisRepository.findOne(filter);
        const teamClusterId = this.toTeamClusterId(analysis?.props.teamCluster);
        if (teamClusterId && analysis) {
            return { teamClusterId, analysisId: analysis._id };
        }

        return null;
    }

    private findExposure(
        plugin: Plugin | null,
        exposureId?: string,
        exposureName?: string
    ): { exposureId: string; exposureName: string } | null {
        if (!plugin) return null;
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

    private deriveColumns(rows: PluginListingRowData[]): ColumnConfig[] {
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
            .map((label) => ({ label, sortable: true }));
    }

    private discoverSubListingNames(documents: DaemonListingRow[]): string[] {
        for (const doc of documents) {
            const names = doc.subListingNames;
            if (names && names.length > 0) return names;
        }
        return [];
    }
}

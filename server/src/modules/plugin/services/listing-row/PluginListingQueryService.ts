import {
    mapDaemonRow,
    mapDaemonRowByAnalysis,
    toListingRowId,
    type DaemonListingRow,
    type DaemonPaginatedResult,
    type DaemonSubListingRow
} from '@modules/plugin/services/listing-row/DaemonListingMapper';
import {
    buildListingColumns,
    buildListingExportColumns,
    enrichDaemonListingRows
} from '@modules/plugin/services/listing-row/ListingRowEnrichmentService';
import { collectAllDaemonPages } from '@modules/plugin/services/listing-row/DaemonListingPager';
import {
    resolveAnalysisCluster,
    resolvePluginListingSource
} from '@modules/plugin/services/listing-row/ListingSourceResolver';
import {
    resolveListingPagination,
    type GetListingRowsByAnalysisIdInput,
    type GetListingRowsByAnalysisIdOutput
} from '@modules/plugin/services/listing-row/ListingRowTypes';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import type {
    ExportPluginListingDocumentsInput,
    GetPluginListingDocumentsInput,
    GetPluginListingDocumentsOutput
} from '@shared/contracts/operations/GetPluginListingDocuments';
import type { GetSubListingInput, GetSubListingOutput } from '@shared/contracts/operations/GetSubListing';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import { createSerializedDownloadResponse } from '@shared/infrastructure/http/responses/download-response';
import { ExportType, type PaginatedResult } from '@shared/domain/port/persistence';

type PageMeta = Omit<PaginatedResult<never>, 'data' | '_meta'>;

const emptyPage = () => ({
    data: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0
});

/**
 * Listing rows live in the compute cluster that ran the analysis, so every read
 * here resolves that cluster first and then queries its daemon. The rows come
 * back from our own daemon over the reverse channel, so they are mapped once and
 * trusted.
 */
export default class PluginListingQueryService {
    #daemonClient: ITeamClusterDaemonClient;

    constructor(daemonClient: ITeamClusterDaemonClient) {
        this.#daemonClient = daemonClient;
    }

    async getListingRowsByAnalysisId(input: GetListingRowsByAnalysisIdInput): Promise<GetListingRowsByAnalysisIdOutput> {
        const { page, limit } = resolveListingPagination(input);
        const teamClusterId = await resolveAnalysisCluster(input.analysisId);
        if (!teamClusterId) {
            return emptyPage();
        }

        const daemonResult = await this.#listListings(teamClusterId, {
            teamId: input.teamId,
            analysisId: input.analysisId,
            page,
            limit
        });
        const rows = await enrichDaemonListingRows({
            rows: daemonResult.data,
            fallbackAnalysisId: input.analysisId
        });

        return {
            data: rows.map(mapDaemonRowByAnalysis),
            ...this.#pageMeta(daemonResult, page, limit)
        };
    }

    async getPluginListingDocuments(input: GetPluginListingDocumentsInput): Promise<GetPluginListingDocumentsOutput> {
        const { page, limit } = resolveListingPagination(input);
        const resolved = await resolvePluginListingSource(input);
        if (!resolved) {
            return {
                ...emptyPage(),
                _meta: {
                    pluginId: '',
                    exposureName: '',
                    exposureId: '',
                    columns: [],
                    subListingNames: []
                }
            };
        }

        const daemonResult = await this.#listListings(resolved.teamClusterId, {
            ...this.#pluginListingFilter(input, resolved.analysisId),
            page,
            limit
        });
        const rows = await enrichDaemonListingRows({
            rows: daemonResult.data,
            fallbackAnalysisId: resolved.analysisId
        });
        const firstRow = rows[0];

        return {
            data: rows.map(mapDaemonRow),
            ...this.#pageMeta(daemonResult, page, limit),
            _meta: {
                pluginId: input.pluginId,
                exposureName: input.exposureName || firstRow?.exposureName || '',
                exposureId: input.exposureId || firstRow?.exposureId || '',
                columns: buildListingColumns(rows, daemonResult.columns),
                subListingNames: daemonResult.subListingNames ?? firstRow?.subListingNames ?? []
            }
        };
    }

    async exportPluginListingDocuments(input: ExportPluginListingDocumentsInput): Promise<DownloadStreamOutput> {
        const format = input.format ?? ExportType.Json;
        const resolved = await resolvePluginListingSource(input);

        if (!resolved) {
            return createSerializedDownloadResponse({
                filename: `${input.pluginId}_${input.exposureId || 'unknown'}_listing`,
                format,
                rows: [],
                columns: []
            });
        }

        const rows = await enrichDaemonListingRows({
            rows: await collectAllDaemonPages<DaemonListingRow>(
                this.#daemonClient,
                resolved.teamClusterId,
                ChannelCommands.PluginListingsList,
                this.#pluginListingFilter(input, resolved.analysisId)
            ),
            fallbackAnalysisId: resolved.analysisId
        });

        return createSerializedDownloadResponse({
            filename: `${input.pluginId}_${input.exposureId || rows[0]?.exposureId || ''}_listing`,
            format,
            rows: rows.map(mapDaemonRow),
            columns: buildListingExportColumns(rows)
        });
    }

    async getSubListing(input: GetSubListingInput): Promise<GetSubListingOutput> {
        const { page, limit } = resolveListingPagination(input);
        const teamClusterId = await resolveAnalysisCluster(input.analysisId);
        if (!teamClusterId) {
            return {
                ...emptyPage(),
                subListingName: input.subListingName,
                columns: [],
                rows: []
            };
        }

        const daemonResult = await this.#daemonClient.command<DaemonPaginatedResult<DaemonSubListingRow>>(
            teamClusterId,
            ChannelCommands.PluginSubListingsList,
            {
                teamId: input.teamId,
                analysisId: input.analysisId,
                exposureId: input.exposureId,
                timestep: input.timestep,
                subListingName: input.subListingName,
                page,
                limit
            }
        );

        const rows = daemonResult.data.map((doc) => ({
            _id: toListingRowId(doc._id),
            ...(doc.row ?? {})
        }));

        return {
            subListingName: input.subListingName,
            columns: Object.keys(daemonResult.data[0]?.row ?? {}).map((key) => ({
                label: key,
                sortable: true
            })),
            rows,
            ...this.#pageMeta(daemonResult, page, limit)
        };
    }

    #listListings(teamClusterId: string, payload: Record<string, unknown>): Promise<DaemonPaginatedResult> {
        return this.#daemonClient.command<DaemonPaginatedResult>(
            teamClusterId,
            ChannelCommands.PluginListingsList,
            payload
        );
    }

    #pluginListingFilter(
        input: GetPluginListingDocumentsInput | ExportPluginListingDocumentsInput,
        analysisId: string
    ): Record<string, unknown> {
        return {
            pluginId: input.pluginId,
            teamId: input.teamId,
            analysisId,
            trajectoryId: input.trajectoryId,
            exposureId: input.exposureId,
            exposureName: input.exposureName
        };
    }

    /** The daemon's own counters win; the request's page/limit only fill in blanks. */
    #pageMeta(daemonResult: DaemonPaginatedResult, page: number, limit: number): PageMeta {
        return {
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit
        };
    }
}

import { In } from 'typeorm';
import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { PluginListingRow, buildPluginListingRowId } from '@modules/plugin/models/plugin-listing-row-model';
import { PluginSubListingRow, buildPluginSubListingRowId } from '@modules/plugin/models/plugin-sub-listing-row-model';
import { calculatePaginationOffset, calculateTotalPages, normalizePagination } from '@shared/contracts/types/pagination';
import { singleton } from '@shared/application/utilities/singleton';
import type { EntityManager, ObjectLiteral, Repository } from 'typeorm';
import type { PluginSubListingRowDocument } from '@modules/plugin/models/plugin-sub-listing-row-model';
import type { PaginatedResult } from '@shared/contracts/types/pagination';
import type {
    PluginListingTransferKind,
    PluginListingTransferExportPayload,
    PluginListingTransferImportPayload,
    PluginListingTransferPurgePayload
} from '@shared/contracts/types/listing-transfer-payloads';
import type {
    BulkUpsertOperation,
    ListingPaginatedResult,
    PluginListingFilter,
    PluginListingTransferRow,
    PluginListingTransferExportResult,
    PluginSubListingFilter,
    ReplaceSubListingRowsInput
} from '@modules/plugin/models/plugin-listing-repository-contract';

const WRITE_CHUNK_SIZE = 1000;

const SUB_LISTING_INSERT_SQL = `
    INSERT INTO plugin_sub_listing_rows ("_id", analysis, "exposureId", timestep, "subListingName", row)
    SELECT batch.i, $2, $3, $4, $5, batch.r
    FROM jsonb_to_recordset($1::jsonb) AS batch(i text, r jsonb)
    ON CONFLICT ("_id") DO UPDATE SET row = EXCLUDED.row
`;

const chunk = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }

    return chunks;
};

const LISTING_COLUMNS = [
    '_id', 'plugin', 'team', 'trajectory', 'analysis',
    'exposureId', 'exposureName', 'timestep', 'row',
    'subListingNames'
] as const;

const SUB_LISTING_COLUMNS = [
    '_id', 'analysis', 'exposureId', 'timestep', 'subListingName', 'row'
] as const;

const pickColumns = <T extends ObjectLiteral>(row: PluginListingTransferRow, columns: readonly string[]): T => {
    const picked: Record<string, unknown> = {};
    for (const column of columns) {
        if (row[column] !== undefined) {
            picked[column] = row[column];
        }
    }

    return picked as T;
};

const normalizeAnalysisIds = (analysisIds: string[]): string[] =>
    [...new Set(analysisIds.filter((analysisId) => analysisId.length > 0))];

const readPage = async <T extends ObjectLiteral>(input: {
    repository: Repository<T>;
    where: Record<string, unknown>;
    page: number;
    limit: number;
}): Promise<PaginatedResult<T>> => {
    const pagination = normalizePagination(input.page, input.limit);
    const skip = calculatePaginationOffset(pagination.page, pagination.limit);
    const [total, data] = await Promise.all([
        input.repository.count({ where: input.where } as never),
        input.repository.find({
            where: input.where,
            order: {
                timestep: 'DESC',
                _id: 'DESC'
            },
            skip,
            take: pagination.limit
        } as never)
    ]);

    return {
        data,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: calculateTotalPages(total, pagination.limit)
    };
};

class TypeOrmPluginListingRepository {
    private get listings(): Repository<PluginListingRow> {
        return getDaemonDataSource().getRepository(PluginListingRow);
    }

    private get subListings(): Repository<PluginSubListingRow> {
        return getDaemonDataSource().getRepository(PluginSubListingRow);
    }

    async listPluginListings(filter: PluginListingFilter): Promise<ListingPaginatedResult> {
        const page = await readPage({
            repository: this.listings,
            where: {
                ...(filter.pluginId ? { plugin: filter.pluginId } : {}),
                ...(filter.trajectoryId ? { trajectory: filter.trajectoryId } : {}),
                ...(filter.analysisId ? { analysis: filter.analysisId } : {}),
                ...(filter.exposureId ? { exposureId: filter.exposureId } : {}),
                ...(filter.exposureName ? { exposureName: filter.exposureName } : {})
            },
            page: filter.page,
            limit: filter.limit
        });

        const columns = new Set<string>();
        let subListingNames: string[] = [];
        for (const document of page.data) {
            for (const key of Object.keys(document.row ?? {})) {
                columns.add(key);
            }

            if (subListingNames.length === 0 && document.subListingNames?.length) {
                subListingNames = document.subListingNames;
            }
        }

        return {
            ...page,
            columns: Array.from(columns),
            subListingNames
        };
    }

    listPluginSubListings(filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>> {
        return readPage({
            repository: this.subListings,
            where: {
                ...(filter.analysisId ? { analysis: filter.analysisId } : {}),
                ...(filter.exposureId ? { exposureId: filter.exposureId } : {}),
                ...(filter.timestep !== undefined ? { timestep: filter.timestep } : {}),
                ...(filter.subListingName ? { subListingName: filter.subListingName } : {})
            },
            page: filter.page,
            limit: filter.limit
        });
    }

    async bulkUpsertListingRows(operations: BulkUpsertOperation[]): Promise<void> {
        if (operations.length === 0) {
            return;
        }

        const rows = operations.map((operation) => ({
            ...operation.update,
            _id: buildPluginListingRowId(
                operation.filter.analysis,
                operation.filter.exposureId,
                operation.filter.timestep
            )
        }));

        for (const batch of chunk(rows, WRITE_CHUNK_SIZE)) {
            await this.listings.upsert(batch as never, ['_id']);
        }
    }

    async replaceSubListingRows(inputs: ReplaceSubListingRowsInput[]): Promise<void> {
        if (inputs.length === 0) {
            return;
        }

        await getDaemonDataSource().transaction(async (manager: EntityManager) => {
            const repository = manager.getRepository(PluginSubListingRow);

            for (const input of inputs) {
                await repository.delete({
                    analysis: input.analysis,
                    exposureId: input.exposureId,
                    timestep: input.timestep,
                    subListingName: input.subListingName
                });
            }

            for (const input of inputs) {
                let index = 0;
                for await (const batch of input.rowBatches) {
                    if (batch.length === 0) {
                        continue;
                    }

                    const payload = batch.map((row) => ({
                        i: buildPluginSubListingRowId(
                            input.analysis,
                            input.exposureId,
                            input.timestep,
                            input.subListingName,
                            index++
                        ),
                        r: row
                    }));

                    await manager.query(SUB_LISTING_INSERT_SQL, [
                        JSON.stringify(payload),
                        input.analysis,
                        input.exposureId,
                        input.timestep,
                        input.subListingName
                    ]);
                }
            }
        });
    }

    async exportListingRows(input: PluginListingTransferExportPayload): Promise<PluginListingTransferExportResult> {
        const analysisIds = normalizeAnalysisIds(input.analysisIds);
        const skip = Math.max(0, input.skip ?? 0);
        const limit = Math.min(500, Math.max(1, input.limit ?? 200));

        if (analysisIds.length === 0) {
            return {
                rows: [],
                total: 0,
                hasMore: false,
                nextSkip: skip
            };
        }

        const where = { analysis: In(analysisIds) };
        const repository = this.repositoryFor(input.documentType);
        const [total, rows] = await Promise.all([
            repository.count({ where } as never),
            repository.find({
                where,
                order: { _id: 'ASC' },
                skip,
                take: limit
            } as never)
        ]);

        return {
            rows: rows as unknown as PluginListingTransferRow[],
            total,
            hasMore: skip + rows.length < total,
            nextSkip: skip + rows.length
        };
    }

    async importListingRows(input: PluginListingTransferImportPayload): Promise<number> {
        const columns = input.documentType === 'listing' ? LISTING_COLUMNS : SUB_LISTING_COLUMNS;
        const rows = input.rows
            .filter((row) => typeof row._id === 'string' && (row._id as string).length > 0)
            .map((row) => pickColumns(row, columns));
        if (rows.length === 0) {
            return 0;
        }

        const repository = this.repositoryFor(input.documentType);
        for (const batch of chunk(rows, WRITE_CHUNK_SIZE)) {
            await repository.upsert(batch as never, ['_id']);
        }

        return rows.length;
    }

    async purgeListingRows(input: PluginListingTransferPurgePayload): Promise<number> {
        const analysisIds = normalizeAnalysisIds(input.analysisIds);
        if (analysisIds.length === 0) {
            return 0;
        }

        const result = await this.repositoryFor(input.documentType)
            .delete({ analysis: In(analysisIds) } as never);
        return result.affected ?? 0;
    }

    private repositoryFor(
        documentType: PluginListingTransferKind
    ): Repository<PluginListingRow> | Repository<PluginSubListingRow> {
        return documentType === 'listing' ? this.listings : this.subListings;
    }
}

export type PluginListingRepository = TypeOrmPluginListingRepository;

export const getPluginListingRepository = singleton(
    (): TypeOrmPluginListingRepository => new TypeOrmPluginListingRepository()
);

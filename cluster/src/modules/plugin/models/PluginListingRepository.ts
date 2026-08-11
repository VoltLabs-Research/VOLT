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

/*
 * Postgres binds at most 65535 parameters per statement, so a batch has a hard
 * ceiling of `limit / columns` rows. 1000 sits well under it for the widest table
 * here and keeps a single failed statement small enough to reason about.
 */
const WRITE_CHUNK_SIZE = 1000;

/**
 * Inserts a whole sub-listing batch with one statement and five parameters.
 *
 * The rows arrive as a single JSON array and are expanded inside Postgres, so the batch
 * size stops being bound by the 65535-parameter ceiling and stops costing one round trip
 * per 1000 rows. That ceiling is why the previous path chunked at `WRITE_CHUNK_SIZE` and
 * issued ~1180 parameterised upserts for a single mesh sub-listing — measured at ~109 s
 * for the 1.18M rows a 2.5M-atom defect mesh emits, against 1.8 s for the 2.5M per-atom
 * rows the columnar path writes to parquet.
 *
 * The keys are one character each because they repeat once per row in the payload.
 * `ON CONFLICT` is kept even though the caller deletes the set first: it makes a rerun
 * that overlaps an interrupted one idempotent rather than a constraint error.
 */
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

/** Columns an imported row may set; anything else a peer cluster sends is dropped. */
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

/**
 * Reads one page and its total in parallel. The count is not optional even though it
 * costs a second scan: the listing UI needs `totalPages` to render its pager.
 */
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
            /* `_id` breaks ties so a page boundary cannot repeat or skip a row. */
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

        /* The listing UI builds its table headers from whatever the plugin reported. */
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
            /* `upsert`'s generics recurse without bound on a spread-built literal. */
            await this.listings.upsert(batch as never, ['_id']);
        }
    }

    /**
     * A rerun of an exposure can emit fewer rows than the run before it, so the old
     * set is deleted rather than upserted over: positional ids would otherwise leave
     * the tail of the previous run behind. Delete and insert share a transaction so a
     * reader never observes a half-replaced sub-listing.
     *
     * Rows are drained from their batch stream and written as they arrive, so a
     * sub-listing of any length costs one batch of heap rather than all of it.
     */
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
                /* Positional across the whole sub-listing, not per batch. */
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
                /* Stable order is what makes the caller's skip cursor safe across calls. */
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

    /** Both tables carry the same identifying columns, so the transfer verbs share a path. */
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

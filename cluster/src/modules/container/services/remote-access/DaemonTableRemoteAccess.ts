import { RemoteExplorerContentType, RemoteExplorerEntryType, RemoteExplorerNodeType, RemoteExplorerTarget } from '@shared/contracts';
import type { ReverseChannelCommandResult } from '@shared/contracts/channel/reverse-channel-messaging';
import { MAX_EXPLORER_DOCUMENTS, buildAttachmentContentDisposition, normalizeExplorerPath, toExplorerDocument, toWebReadableStream } from '@modules/container/services/remote-access/shared';
import type { RemoteExplorerEntry, RemoteExplorerDocument, RemoteExplorerNode } from '@shared/contracts';
import BaseRemoteAccess from '@modules/container/services/remote-access/BaseRemoteAccess';
import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { PluginListingRow } from '@modules/plugin/models/plugin-listing-row-model';
import { PluginSubListingRow } from '@modules/plugin/models/plugin-sub-listing-row-model';
import { Readable } from 'node:stream';
import type { EntityTarget, ObjectLiteral } from 'typeorm';

/*
 * Only the tables the daemon owns are browsable, named explicitly rather than read
 * from the metadata catalog: the explorer takes a path from the caller, and mapping
 * it through a fixed allowlist is what keeps that path from reaching anything else
 * in the database.
 */
const BROWSABLE_TABLES: Record<string, EntityTarget<ObjectLiteral>> = {
    plugin_listing_rows: PluginListingRow,
    plugin_sub_listing_rows: PluginSubListingRow
};

/** Browses the daemon's relational tables: the listing data plugins produce. */
export default class DaemonTableRemoteAccess extends BaseRemoteAccess {
    readonly target = RemoteExplorerTarget.DaemonTables;

    async list(): Promise<RemoteExplorerEntry[]> {
        const dataSource = getDaemonDataSource();

        return Promise.all(Object.keys(BROWSABLE_TABLES).sort().map(async (name) => ({
            id: name,
            name,
            path: name,
            type: RemoteExplorerEntryType.Collection,
            size: await dataSource.getRepository(BROWSABLE_TABLES[name]).count(),
            updatedAt: null,
            description: 'Table'
        })));
    }

    async node(path: string): Promise<RemoteExplorerNode> {
        const tableName = normalizeExplorerPath(path);
        if (!tableName) {
            return {
                path,
                title: 'Daemon tables',
                type: RemoteExplorerNodeType.Collection,
                contentType: RemoteExplorerContentType.Empty,
                textContent: null,
                documents: []
            };
        }

        return {
            path,
            title: tableName,
            type: RemoteExplorerNodeType.Collection,
            contentType: RemoteExplorerContentType.DaemonRows,
            textContent: null,
            documents: (await this.readRows(tableName, MAX_EXPLORER_DOCUMENTS)).map(toExplorerDocument)
        };
    }

    async download(path: string): Promise<ReverseChannelCommandResult> {
        const tableName = normalizeExplorerPath(path);
        if (!tableName) {
            throw new Error('Table download requires a table name');
        }

        const readRows = (offset: number, limit: number): Promise<ObjectLiteral[]> =>
            this.readRows(tableName, limit, offset);

        return {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'content-disposition': buildAttachmentContentDisposition(`${tableName}.json`)
            },
            /*
             * Paged rather than a single query: a sub-listing table can hold millions of
             * rows, and the point of streaming the download is to never hold them all.
             */
            stream: toWebReadableStream(Readable.from((async function* () {
                const pageSize = 1000;
                let offset = 0;
                let isFirst = true;

                yield Buffer.from('[', 'utf8');

                for (;;) {
                    const rows = await readRows(offset, pageSize);
                    if (rows.length === 0) break;

                    for (const row of rows) {
                        const serialized = JSON.stringify(toExplorerDocument(row).value);
                        yield Buffer.from(isFirst ? serialized : `,${serialized}`, 'utf8');
                        isFirst = false;
                    }

                    if (rows.length < pageSize) break;
                    offset += rows.length;
                }

                yield Buffer.from(']', 'utf8');
            })()))
        };
    }

    private readRows(tableName: string, limit: number, offset = 0): Promise<ObjectLiteral[]> {
        const entity = BROWSABLE_TABLES[tableName];
        if (!entity) {
            throw new Error(`Unknown daemon table: ${tableName}`);
        }

        return getDaemonDataSource().getRepository(entity).find({
            order: { _id: 'ASC' },
            skip: offset,
            take: limit
        } as never);
    }
};

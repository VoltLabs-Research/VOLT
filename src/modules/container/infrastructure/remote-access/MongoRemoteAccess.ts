import { RemoteExplorerContentType, RemoteExplorerEntryType, RemoteExplorerNodeType, RemoteExplorerTarget } from '@/contracts';
import type { ReverseChannelCommandResult } from '@/core/reverse-channel/contracts/command-handler';
import { MAX_MONGO_DOCUMENTS, buildAttachmentContentDisposition, normalizeExplorerPath, toMongoDocument, toWebReadableStream } from '@/modules/container/infrastructure/remote-access/shared';
import type { RemoteExplorerEntry, RemoteExplorerMongoDocument, RemoteExplorerNode } from '@/contracts';
import BaseRemoteAccess from '@/modules/container/infrastructure/remote-access/BaseRemoteAccess';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';

export default class MongoRemoteAccess extends BaseRemoteAccess {
    readonly target = RemoteExplorerTarget.MongoDocuments;

    async list(): Promise<RemoteExplorerEntry[]> {
        const collections = await this.readDatabase().listCollections({}, { nameOnly: true }).toArray();

        return collections
            .map((collection) => ({
                id: collection.name,
                name: collection.name,
                path: collection.name,
                type: RemoteExplorerEntryType.Collection,
                size: null,
                updatedAt: null,
                description: 'Collection'
            }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    async node(path: string): Promise<RemoteExplorerNode> {
        const collectionName = normalizeExplorerPath(path);
        if (!collectionName) {
            return {
                path,
                title: 'MongoDB',
                type: RemoteExplorerNodeType.Collection,
                contentType: RemoteExplorerContentType.Empty,
                textContent: null,
                mongoDocuments: []
            };
        }

        return {
            path,
            title: collectionName,
            type: RemoteExplorerNodeType.Collection,
            contentType: RemoteExplorerContentType.MongoDocuments,
            textContent: null,
            mongoDocuments: await this.collectDocuments(collectionName)
        };
    }

    async download(path: string): Promise<ReverseChannelCommandResult> {
        const collectionName = normalizeExplorerPath(path);
        if (!collectionName) {
            throw new Error('Mongo download requires a collection name');
        }

        const cursor = this.createCursor(collectionName);

        return {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'content-disposition': buildAttachmentContentDisposition(`${collectionName}.json`)
            },
            stream: toWebReadableStream(Readable.from((async function* () {
                let isFirst = true;

                try {
                    yield Buffer.from('[', 'utf8');

                    for await (const document of cursor) {
                        const serializedDocument = JSON.stringify(toMongoDocument(document));
                        yield Buffer.from(isFirst ? serializedDocument : `,${serializedDocument}`, 'utf8');
                        isFirst = false;
                    }

                    yield Buffer.from(']', 'utf8');
                } finally {
                    await cursor.close().catch(() => undefined);
                }
            })()))
        };
    }

    private readDatabase() {
        const database = mongoose.connection.db;
        if (!database) {
            throw new Error('MongoDB connection is not ready');
        }

        return database;
    }

    private createCursor(collectionName: string) {
        return this.readDatabase().collection(collectionName)
            .find({})
            .limit(MAX_MONGO_DOCUMENTS);
    }

    private async collectDocuments(collectionName: string): Promise<RemoteExplorerMongoDocument[]> {
        const cursor = this.createCursor(collectionName);
        const documents: RemoteExplorerMongoDocument[] = [];

        try {
            for await (const document of cursor) {
                documents.push(toMongoDocument(document));
            }
        } finally {
            await cursor.close().catch(() => undefined);
        }

        return documents;
    }
};

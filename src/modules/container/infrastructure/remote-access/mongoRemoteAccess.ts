import { RemoteExplorerContentType, RemoteExplorerEntryType, RemoteExplorerNodeType, type RemoteExplorerEntry, type RemoteExplorerMongoDocument, type RemoteExplorerNode } from '@/contracts';
import type { ReverseChannelCommandResult } from '@/core/reverse-channel/contracts/commandHandler';
import { MAX_MONGO_DOCUMENTS, buildAttachmentContentDisposition, normalizeExplorerPath, toMongoDocument, toWebReadableStream } from '@/modules/container/infrastructure/remote-access/shared';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';

const readDatabase = () => {
    const database = mongoose.connection.db;
    if (!database) {
        throw new Error('MongoDB connection is not ready');
    }

    return database;
};

const createMongoCursor = (collectionName: string) => {
    return readDatabase().collection(collectionName)
        .find({})
        .limit(MAX_MONGO_DOCUMENTS);
};

const collectMongoDocuments = async (collectionName: string): Promise<RemoteExplorerMongoDocument[]> => {
    const cursor = createMongoCursor(collectionName);
    const documents: RemoteExplorerMongoDocument[] = [];

    try {
        for await (const document of cursor) {
            documents.push(toMongoDocument(document));
        }
    } finally {
        await cursor.close().catch(() => undefined);
    }

    return documents;
};

const createMongoDocumentsJsonStream = (collectionName: string): Readable => {
    const cursor = createMongoCursor(collectionName);

    return Readable.from((async function* () {
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
    })());
};

export const buildMongoEntries = async (): Promise<RemoteExplorerEntry[]> => {
    const collections = await readDatabase().listCollections({}, { nameOnly: true }).toArray();

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
};

export const buildMongoNode = async (path: string): Promise<RemoteExplorerNode> => {
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
        mongoDocuments: await collectMongoDocuments(collectionName)
    };
};

export const buildMongoDownloadResponse = async (path: string): Promise<ReverseChannelCommandResult> => {
    const collectionName = normalizeExplorerPath(path);
    if (!collectionName) {
        throw new Error('Mongo download requires a collection name');
    }

    return {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'content-disposition': buildAttachmentContentDisposition(`${collectionName}.json`)
        },
        stream: toWebReadableStream(createMongoDocumentsJsonStream(collectionName))
    };
};

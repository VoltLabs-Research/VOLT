import {
    RemoteExplorerContentType,
    RemoteExplorerEntryType,
    RemoteExplorerNodeType,
    type RemoteExplorerEntry,
    type RemoteExplorerNode
} from '@/shared/contracts';
import type { ReverseChannelCommandResult } from '../../services';
import {
    MAX_MONGO_DOCUMENTS,
    buildAttachmentContentDisposition,
    normalizeExplorerPath,
    toMongoDocument,
    toWebReadableStream
} from './shared';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';

const readDatabase = () => {
    const database = mongoose.connection.db;
    if (!database) {
        throw new Error('MongoDB connection is not ready');
    }

    return database;
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

    const documents = await readDatabase().collection(collectionName)
        .find({})
        .limit(MAX_MONGO_DOCUMENTS)
        .toArray();

    return {
        path,
        title: collectionName,
        type: RemoteExplorerNodeType.Collection,
        contentType: RemoteExplorerContentType.MongoDocuments,
        textContent: null,
        mongoDocuments: documents.map(toMongoDocument)
    };
};

export const buildMongoDownloadResponse = async (path: string): Promise<ReverseChannelCommandResult> => {
    const collectionName = normalizeExplorerPath(path);
    if (!collectionName) {
        throw new Error('Mongo download requires a collection name');
    }

    const documents = await readDatabase().collection(collectionName)
        .find({})
        .limit(MAX_MONGO_DOCUMENTS)
        .toArray();
    const buffer = Buffer.from(JSON.stringify(documents.map(toMongoDocument), null, 2), 'utf-8');

    return {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'content-length': String(buffer.byteLength),
            'content-disposition': buildAttachmentContentDisposition(`${collectionName}.json`)
        },
        stream: toWebReadableStream(Readable.from([buffer]))
    };
};

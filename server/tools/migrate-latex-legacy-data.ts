import 'dotenv/config';
import mongoose from 'mongoose';
import mongoConnector from '../src/shared/infrastructure/utilities/mongo-connector';
import LatexAssetModel from '../src/modules/latex/infrastructure/persistence/mongo/models/LatexAssetModel';
import LatexDocumentModel from '../src/modules/latex/infrastructure/persistence/mongo/models/LatexDocumentModel';
import LatexFileModel from '../src/modules/latex/infrastructure/persistence/mongo/models/LatexFileModel';
import { sanitizeAssetPath } from '../src/modules/latex/application/utilities/sanitize-asset-path';

const DEFAULT_ENTRYPOINT_NAME = 'main.tex';

interface LegacyLatexDocumentRecord {
    _id: unknown;
    team: unknown;
    createdBy: unknown;
    createdAt?: Date;
    updatedAt?: Date;
    content?: unknown;
}

interface LegacyLatexAssetRecord {
    _id: unknown;
    originalName?: unknown;
}

const asString = (value: unknown, fallback = ''): string => {
    if (typeof value === 'string') {
        return value;
    }

    if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
        return value.toString();
    }

    return fallback;
};

const migrateLegacyDocumentContent = async (): Promise<number> => {
    let migratedCount = 0;

    const cursor = LatexDocumentModel.collection.find<LegacyLatexDocumentRecord>(
        {},
        {
            projection: {
                _id: 1,
                team: 1,
                createdBy: 1,
                createdAt: 1,
                updatedAt: 1,
                content: 1
            }
        }
    );

    for await (const document of cursor) {
        const documentId = asString(document._id);
        if (!documentId) {
            continue;
        }

        const existingFileCount = await LatexFileModel.countDocuments({ document: documentId });
        if (existingFileCount > 0) {
            continue;
        }

        const content = typeof document.content === 'string' ? document.content : '';
        const createdAt = document.createdAt ?? new Date();
        const updatedAt = document.updatedAt ?? createdAt;

        await LatexFileModel.create({
            document: documentId,
            team: asString(document.team),
            name: DEFAULT_ENTRYPOINT_NAME,
            path: '',
            content,
            isEntrypoint: true,
            createdBy: asString(document.createdBy),
            createdAt,
            updatedAt
        });

        migratedCount++;
    }

    return migratedCount;
};

const migrateLegacyAssetPaths = async (): Promise<number> => {
    let migratedCount = 0;

    const cursor = LatexAssetModel.collection.find<LegacyLatexAssetRecord>(
        {
            $or: [
                { path: { $exists: false } },
                { path: null },
                { path: '' }
            ]
        },
        {
            projection: {
                _id: 1,
                originalName: 1
            }
        }
    );

    for await (const asset of cursor) {
        const assetId = new mongoose.Types.ObjectId(asString(asset._id));
        const originalName = typeof asset.originalName === 'string' && asset.originalName
            ? asset.originalName
            : 'asset';
        const nextPath = sanitizeAssetPath(originalName, originalName);

        await LatexAssetModel.collection.updateOne(
            { _id: assetId },
            { $set: { path: nextPath } }
        );

        migratedCount++;
    }

    return migratedCount;
};

const removeLegacyDocumentContentField = async (): Promise<number> => {
    const result = await LatexDocumentModel.collection.updateMany(
        { content: { $exists: true } },
        { $unset: { content: '' } }
    );

    return result.modifiedCount ?? 0;
};

const main = async (): Promise<void> => {
    await mongoConnector();

    const migratedDocuments = await migrateLegacyDocumentContent();
    const migratedAssets = await migrateLegacyAssetPaths();
    const strippedContentFields = await removeLegacyDocumentContentField();

    console.log(JSON.stringify({
        migratedDocuments,
        migratedAssets,
        strippedContentFields
    }, null, 2));
};

main()
    .then(async () => {
        await mongoose.disconnect();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('[latex-migration] Error:', error);
        await mongoose.disconnect().catch(() => undefined);
        process.exit(1);
    });

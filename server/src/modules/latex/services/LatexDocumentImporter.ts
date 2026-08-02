
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import LatexDocumentEntity from '@modules/latex/models/LatexDocument';
import LatexFileEntity from '@modules/latex/models/LatexFile';
import LatexAssetEntity from '@modules/latex/models/LatexAsset';
import {
    buildLatexAssetContentUrl,
    buildLatexAssetStorageKey,
    sanitizeAssetPath
} from '@modules/latex/services/LatexAssetStorage';
import ApplicationError from '@shared/application/errors/ApplicationError';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import path from 'node:path';
import unzipper from 'unzipper';
import { v4 } from 'uuid';
import { toDocumentView } from '@modules/latex/services/latex-views';
import type {
    LatexDocument
} from '@volt/contracts/modules/latex/domain';
import type { LatexDocumentImportRequest } from '@modules/latex/contracts/latex-document';
import {
    MAIN_TEX_FILENAME
} from '@modules/latex/services/latex-constants';

const BINARY_ASSET_MIMETYPE = 'application/octet-stream';

interface ImportedAsset{
    buffer: Buffer;
    originalName: string;
    path: string;
    mimetype: string;
}

const deriveTitle = (filename: string): string => {
    const base = path.basename(filename, path.extname(filename));
    const cleaned = base.trim().replace(/[_-]+/g, ' ');
    return cleaned || 'Imported Document';
};

const createDocument = (
    input: LatexDocumentImportRequest,
    storageClusterId: string
): Promise<LatexDocumentEntity> => {
    return LatexDocumentEntity.create({
        team: input.teamId,
        title: deriveTitle(input.file.originalname),
        folder: input.folderId ?? null,
        storageClusterId,
        createdBy: input.userId,
        lastEditedBy: null
    }).save();
};

const createFile = (
    input: LatexDocumentImportRequest,
    documentId: string,
    file: Pick<LatexFileEntity, 'name' | 'path' | 'content' | 'isEntrypoint'>
): Promise<LatexFileEntity> => {
    return LatexFileEntity.create({
        document: documentId,
        team: input.teamId,
        name: file.name,
        path: file.path,
        content: file.content,
        isEntrypoint: file.isEntrypoint,
        createdBy: input.userId
    }).save();
};

const createMainTexFile = (
    input: LatexDocumentImportRequest,
    documentId: string,
    content: string
): Promise<LatexFileEntity> => {
    return createFile(input, documentId, {
        name: MAIN_TEX_FILENAME,
        path: '',
        content,
        isEntrypoint: true
    });
};

const storeAsset = async (
    input: LatexDocumentImportRequest,
    documentId: string,
    storageClusterId: string,
    asset: ImportedAsset
): Promise<void> => {
    const storageKey = buildLatexAssetStorageKey(
        input.teamId,
        documentId,
        v4(),
        path.extname(asset.originalName)
    );

    await objectGatewayClient.putBuffer(storageClusterId, {
        bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
        objectKey: storageKey,
        buffer: asset.buffer,
        contentLength: asset.buffer.byteLength,
        contentType: asset.mimetype
    });

    await LatexAssetEntity.create({
        team: input.teamId,
        document: documentId,
        originalName: asset.originalName,
        path: asset.path,
        storageKey,
        url: buildLatexAssetContentUrl(input.teamId, documentId, storageKey),
        mimetype: asset.mimetype,
        size: asset.buffer.byteLength,
        createdBy: input.userId
    }).save();
};

/**
 * Builds a LaTeX document from an uploaded .tex, .zip or .pdf payload.
 * Each format is a separate entry point; the caller decides which to use.
 */
export default class LatexDocumentImporter{
    async fromTex(input: LatexDocumentImportRequest, storageClusterId: string): Promise<LatexDocument>{
        const document = await createDocument(input, storageClusterId);

        await createMainTexFile(input, document.id, input.file.buffer.toString('utf-8'));

        return toDocumentView(document);
    }

    async fromZip(input: LatexDocumentImportRequest, storageClusterId: string): Promise<LatexDocument>{
        let directory: unzipper.CentralDirectory;
        try{
            directory = await unzipper.Open.buffer(input.file.buffer);
        }catch{
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid ZIP archive');
        }

        const mainTexFile = directory.files.find(
            (f) => f.path === MAIN_TEX_FILENAME || f.path.endsWith(`/${MAIN_TEX_FILENAME}`)
        );
        if(!mainTexFile){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'ZIP archive must contain a main.tex file');
        }

        const mainTexBuffer = await mainTexFile.buffer();
        const document = await createDocument(input, storageClusterId);
        const documentId = document.id;

        await createMainTexFile(input, documentId, mainTexBuffer.toString('utf-8'));

        const otherFiles = directory.files.filter((f) => {
            const filePath = f.path;
            return !filePath.endsWith('/') && filePath !== MAIN_TEX_FILENAME && f.path !== mainTexFile.path;
        });

        const texFiles = otherFiles.filter((f) => f.path.endsWith('.tex'));
        const assetFiles = otherFiles.filter((f) => !f.path.endsWith('.tex'));

        await Promise.allSettled(
            texFiles.map(async (texFile) => {
                const buffer = await texFile.buffer();
                const dirPart = path.dirname(texFile.path);

                await createFile(input, documentId, {
                    name: path.basename(texFile.path),
                    path: dirPart === '.' ? '' : `${dirPart}/`,
                    content: buffer.toString('utf-8'),
                    isEntrypoint: false
                });
            })
        );

        await Promise.allSettled(
            assetFiles.map(async (assetFile) => {
                const originalName = path.basename(assetFile.path);

                await storeAsset(input, documentId, storageClusterId, {
                    buffer: await assetFile.buffer(),
                    originalName,
                    path: sanitizeAssetPath(assetFile.path, originalName),
                    mimetype: BINARY_ASSET_MIMETYPE
                });
            })
        );

        return toDocumentView(document);
    }

    async fromPdf(input: LatexDocumentImportRequest, storageClusterId: string): Promise<LatexDocument>{
        const originalName = input.file.originalname;

        const mainTexContent = [
            '\\documentclass{article}',
            '\\usepackage{pdfpages}',
            '\\begin{document}',
            `\\includepdf[pages=-]{${originalName}}`,
            '\\end{document}'
        ].join('\n');

        const document = await createDocument(input, storageClusterId);

        await storeAsset(input, document.id, storageClusterId, {
            buffer: input.file.buffer,
            originalName,
            path: originalName,
            mimetype: input.file.mimetype
        });

        await createMainTexFile(input, document.id, mainTexContent);

        return toDocumentView(document);
    }
}

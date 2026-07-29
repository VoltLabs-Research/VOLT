
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
import type {
    ITeamClusterObjectGatewayClient
} from '@shared/contracts/ports';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import path from 'node:path';
import unzipper from 'unzipper';
import { v4 } from 'uuid';
import { toDocumentView } from '@modules/latex/services/latex-views';
import type {
    LatexDocument
} from '@volt/contracts/modules/latex/domain';
import {
    MAIN_TEX_FILENAME
} from '@modules/latex/services/latex-constants';

/**
 * Builds a LaTeX document from an uploaded .tex, .zip or .pdf payload.
 * Each format is a separate entry point; the caller decides which to use.
 */
export default class LatexDocumentImporter{
    #objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;

    #deriveTitle(filename: string): string{
        const base = path.basename(filename, path.extname(filename));
        const cleaned = base.trim().replace(/[_-]+/g, ' ');
        return cleaned || 'Imported Document';
    }

    async fromTex(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocument>{
        const content = input.file.buffer.toString('utf-8');
        const title = this.#deriveTitle(input.file.originalname);

        const document = await LatexDocumentEntity.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: null
        }).save();

        await LatexFileEntity.create({
            document: document.id,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content,
            isEntrypoint: true,
            createdBy: input.userId
        }).save();

        return toDocumentView(document);
    }

    async fromZip(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocument>{
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
        const content = mainTexBuffer.toString('utf-8');
        const title = this.#deriveTitle(input.file.originalname);

        const document = await LatexDocumentEntity.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: null
        }).save();
        const documentId = document.id;

        await LatexFileEntity.create({
            document: documentId,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content,
            isEntrypoint: true,
            createdBy: input.userId
        }).save();

        const otherFiles = directory.files.filter((f) => {
            const filePath = f.path;
            return !filePath.endsWith('/') && filePath !== MAIN_TEX_FILENAME && f.path !== mainTexFile.path;
        });

        const texFiles = otherFiles.filter((f) => f.path.endsWith('.tex'));
        const assetFiles = otherFiles.filter((f) => !f.path.endsWith('.tex'));

        await Promise.allSettled(
            texFiles.map(async (texFile) => {
                const buffer = await texFile.buffer();
                const fileContent = buffer.toString('utf-8');
                const fileName = path.basename(texFile.path);
                const dirPart = path.dirname(texFile.path);
                const filePath = dirPart === '.' ? '' : `${dirPart}/`;

                await LatexFileEntity.create({
                    document: documentId,
                    team: input.teamId,
                    name: fileName,
                    path: filePath,
                    content: fileContent,
                    isEntrypoint: false,
                    createdBy: input.userId
                }).save();
            })
        );

        await Promise.allSettled(
            assetFiles.map((assetFile) => this.#uploadAssetFromZipEntry(assetFile, documentId, storageClusterId, input.teamId, input.userId))
        );

        return toDocumentView(document);
    }

    async fromPdf(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocument>{
        const originalName = input.file.originalname ?? 'imported.pdf';
        const title = this.#deriveTitle(originalName);
        const ext = path.extname(originalName);
        const mimetype = input.file.mimetype ?? 'application/pdf';

        const mainTexContent = [
            '\\documentclass{article}',
            '\\usepackage{pdfpages}',
            '\\begin{document}',
            `\\includepdf[pages=-]{${originalName}}`,
            '\\end{document}'
        ].join('\n');

        const document = await LatexDocumentEntity.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: null
        }).save();
        const documentId = document.id;
        const storageKey = buildLatexAssetStorageKey(input.teamId, documentId, v4(), ext);
        const url = buildLatexAssetContentUrl(input.teamId, documentId, storageKey);

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            objectKey: storageKey,
            buffer: input.file.buffer,
            contentLength: input.file.buffer.byteLength,
            contentType: mimetype
        });

        await LatexFileEntity.create({
            document: documentId,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content: mainTexContent,
            isEntrypoint: true,
            createdBy: input.userId
        }).save();

        await LatexAssetEntity.create({
            team: input.teamId,
            document: documentId,
            originalName,
            path: originalName,
            storageKey,
            url,
            mimetype,
            size: input.file.buffer.byteLength,
            createdBy: input.userId
        }).save();

        return toDocumentView(document);
    }

    async #uploadAssetFromZipEntry(
        assetFile: unzipper.File,
        documentId: string,
        storageClusterId: string,
        teamId: string,
        userId: string
    ): Promise<void>{
        const buffer = await assetFile.buffer();
        const originalName = path.basename(assetFile.path);
        const ext = path.extname(originalName);
        const storageKey = buildLatexAssetStorageKey(teamId, documentId, v4(), ext);
        const mimetype = 'application/octet-stream';
        const assetPath = sanitizeAssetPath(assetFile.path, originalName);
        const url = buildLatexAssetContentUrl(teamId, documentId, storageKey);

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            objectKey: storageKey,
            buffer,
            contentLength: buffer.byteLength,
            contentType: mimetype
        });

        await LatexAssetEntity.create({
            team: teamId,
            document: documentId,
            originalName,
            path: assetPath,
            storageKey,
            url,
            mimetype,
            size: buffer.byteLength,
            createdBy: userId
        }).save();
    }
}

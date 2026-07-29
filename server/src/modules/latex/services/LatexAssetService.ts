
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import LatexAssetEntity from '@modules/latex/models/LatexAsset';
import {
    assertLatexAssetStorageKey,
    buildLatexAssetContentUrl,
    buildLatexAssetStorageKey,
    requireLatexStorageClusterId,
    sanitizeAssetPath
} from '@modules/latex/services/LatexAssetStorage';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    ITeamClusterObjectGatewayClient
} from '@shared/contracts/ports';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import path from 'node:path';
import { Readable } from 'node:stream';
import { v4 } from 'uuid';
import {
    MAX_ASSET_SIZE
} from '@modules/latex/services/latex-constants';
import type {
    UploadLatexAssetInput
} from '@volt/contracts/modules/latex/http';
import type {
    LatexAsset,
    UploadLatexAssetResult,
    LatexAssetUploadTarget
} from '@volt/contracts/modules/latex/domain';
import {
    findAssetsByDocument,
    requireDocument
} from '@modules/latex/services/latex-queries';
import type {
    DocumentScoped
} from '@modules/latex/services/latex-queries';

/**
 * Binary assets attached to a LaTeX document: listing, upload targets,
 * content streaming and path renames.
 */
export default class LatexAssetService{
    #signedUrlService = new ClusterObjectSignedUrlService();
    #objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;

    async listAssets(input: DocumentScoped): Promise<LatexAsset[]>{
        await requireDocument(input.teamId, input.documentId);

        const assets = await findAssetsByDocument(input.documentId);
        return assets.map((asset) => this.#toAssetView(input.teamId, input.documentId, asset));
    }

    async getAssetContent(input: DocumentScoped & { key: string }): Promise<{ stream: Readable; contentType?: string; contentLength?: number; contentEncoding?: string }>{
        const document = await requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);
        assertLatexAssetStorageKey(input.teamId, input.documentId, input.key);

        const response = await this.#objectGatewayClient.getStream(
            storageClusterId,
            TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            input.key
        );

        return {
            stream: response.stream,
            contentType: response.contentType,
            contentLength: response.contentLength,
            contentEncoding: response.contentEncoding
        };
    }

    async uploadAsset(input: UploadLatexAssetInput & DocumentScoped & { userId: string }): Promise<UploadLatexAssetResult>{
        const validFiles = (input.files ?? [])
            .map((file, uploadIndex) => ({
                file,
                uploadIndex
            }))
            .filter(({ file }) => file && file.name && file.size >= 0);

        if(validFiles.length === 0){
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'No valid files provided');
        }

        const document = await requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);

        const uploaded: LatexAssetUploadTarget[] = [];
        let failedCount = 0;

        for(const { file, uploadIndex } of validFiles){
            if(file.size > MAX_ASSET_SIZE){
                failedCount++;
                continue;
            }

            try{
                const ext = path.extname(file.name);
                const storageKey = buildLatexAssetStorageKey(input.teamId, input.documentId, v4(), ext);
                const mimetype = file.type || 'application/octet-stream';
                const assetPath = sanitizeAssetPath(input.path ?? file.name, file.name);
                const url = buildLatexAssetContentUrl(input.teamId, input.documentId, storageKey);

                const asset = await LatexAssetEntity.create({
                    team: input.teamId,
                    document: input.documentId,
                    originalName: file.name,
                    path: assetPath,
                    storageKey,
                    url,
                    mimetype,
                    size: file.size,
                    createdBy: input.userId
                }).save();

                const signed = this.#signedUrlService.createToken({
                    kind: 'cluster-object',
                    operation: 'write',
                    teamId: input.teamId,
                    userId: input.userId,
                    ownerClusterId: storageClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    objectKey: storageKey,
                    resourceKind: 'latex-asset',
                    resourceId: asset.id,
                    contentLength: file.size,
                    contentType: mimetype
                });

                uploaded.push({
                    _id: asset.id,
                    uploadIndex,
                    documentId: asset.document,
                    originalName: asset.originalName,
                    path: asset.path,
                    url: buildLatexAssetContentUrl(input.teamId, input.documentId, asset.storageKey),
                    mimetype: asset.mimetype,
                    size: asset.size,
                    createdAt: asset.createdAt as unknown as string,
                    uploadUrl: signed.url,
                    expiresAt: signed.expiresAt
                });
            }catch{
                failedCount++;
            }
        }

        return {
            uploaded,
            failedCount,
            total: validFiles.length
        };
    }

    async deleteAsset(input: DocumentScoped & { assetId: string }): Promise<void>{
        const document = await requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);

        const asset = await LatexAssetEntity.findOneBy({
            id: input.assetId,
            document: input.documentId
        });
        if(!asset){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX asset not found');
        }

        try{
            await this.#objectGatewayClient.deleteObject(storageClusterId, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS, asset.storageKey);
        }catch(error){
            if(!(error instanceof ApplicationError) || error.statusCode !== 404){
                throw error;
            }
        }
        await LatexAssetEntity.delete({ id: input.assetId });
    }

    async updateAsset(input: DocumentScoped & { assetId: string; path: string }): Promise<LatexAsset>{
        await requireDocument(input.teamId, input.documentId);

        const asset = await LatexAssetEntity.findOneBy({
            id: input.assetId,
            document: input.documentId
        });
        if(!asset){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX asset not found');
        }

        const safePath = sanitizeAssetPath(input.path, asset.originalName);
        const updated = await Object.assign(asset, {
            path: safePath,
            updatedAt: new Date()
        }).save();
        return this.#toAssetView(input.teamId, input.documentId, updated);
    }

    #toAssetView(teamId: string, documentId: string, asset: LatexAssetEntity): LatexAsset{
        return {
            _id: asset.id,
            documentId: asset.document,
            originalName: asset.originalName,
            path: asset.path,
            url: buildLatexAssetContentUrl(teamId, documentId, asset.storageKey),
            mimetype: asset.mimetype,
            size: asset.size,
            createdAt: asset.createdAt as unknown as string
        };
    }
}

import { ErrorCodes } from '@core/constants/error-codes';
import LatexAssetEntity from '@modules/latex/models/LatexAsset';
import LatexDocumentEntity from '@modules/latex/models/LatexDocument';
import LatexFileEntity from '@modules/latex/models/LatexFile';
import ApplicationError from '@shared/application/errors/ApplicationError';

export interface TeamScoped{ teamId: string }
export interface DocumentScoped extends TeamScoped{ documentId: string }

const TEX_EXTENSION = '.tex';

const FILE_ORDER_OPTIONS = {
    path: 'ASC',
    name: 'ASC'
} as const;

export const requireDocument = async (teamId: string, documentId: string): Promise<LatexDocumentEntity> => {
    const document = await LatexDocumentEntity.findOneBy({
        id: documentId,
        team: teamId
    });
    if(!document) throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found');
    return document;
};

export const requireFile = async (documentId: string, fileId: string): Promise<LatexFileEntity> => {
    const file = await LatexFileEntity.findOneBy({
        id: fileId,
        document: documentId
    });
    if(!file) throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
    return file;
};

export const requireAsset = async (documentId: string, assetId: string): Promise<LatexAssetEntity> => {
    const asset = await LatexAssetEntity.findOneBy({
        id: assetId,
        document: documentId
    });
    if(!asset) throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX asset not found');
    return asset;
};

export const findFilesByDocument = (documentId: string): Promise<LatexFileEntity[]> => {
    return LatexFileEntity.find({
        where: { document: documentId },
        order: FILE_ORDER_OPTIONS
    });
};

export const findEntrypoint = <T extends Pick<LatexFileEntity, 'name' | 'isEntrypoint'>>(
    files: T[]
): T | undefined => {
    return files.find((file) => file.isEntrypoint)
        ?? files.find((file) => file.name.toLowerCase().endsWith(TEX_EXTENSION));
};

export const findAssetsByDocument = (documentId: string): Promise<LatexAssetEntity[]> => {
    return LatexAssetEntity.find({
        where: { document: documentId },
        order: { createdAt: 'DESC' }
    });
};

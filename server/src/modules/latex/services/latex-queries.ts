import { ErrorCodes } from '@core/constants/error-codes';
import LatexAssetEntity from '@modules/latex/models/LatexAsset';
import LatexDocumentEntity from '@modules/latex/models/LatexDocument';
import LatexFileEntity from '@modules/latex/models/LatexFile';
import ApplicationError from '@shared/application/errors/ApplicationError';

export interface TeamScoped{ teamId: string }
export interface DocumentScoped extends TeamScoped{ documentId: string }

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

export const findFilesByDocument = (documentId: string): Promise<LatexFileEntity[]> => {
    return LatexFileEntity.find({
        where: { document: documentId },
        order: FILE_ORDER_OPTIONS
    });
};

export const findAssetsByDocument = (documentId: string): Promise<LatexAssetEntity[]> => {
    return LatexAssetEntity.find({
        where: { document: documentId },
        order: { createdAt: 'DESC' }
    });
};

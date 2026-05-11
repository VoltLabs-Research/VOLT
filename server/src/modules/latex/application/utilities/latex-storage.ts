import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import ApplicationError from '@shared/application/errors/ApplicationError';

const buildAssetPrefix = (teamId: string, documentId: string): string => {
    return `latex-assets/${teamId}/${documentId}/`;
};

export const requireLatexStorageClusterId = (
    documentId: string,
    document: Pick<LatexDocumentProps, 'storageClusterId'>
): string => {
    if (document.storageClusterId && document.storageClusterId.trim().length > 0) {
        return document.storageClusterId;
    }

    throw ApplicationError.conflict(
        'LatexDocument::StorageClusterRequired',
        `LaTeX document ${documentId} does not have a storage cluster assigned`
    );
};

export const buildLatexAssetStorageKey = (
    teamId: string,
    documentId: string,
    uniqueId: string,
    ext: string
): string => {
    return `${buildAssetPrefix(teamId, documentId)}${uniqueId}${ext}`;
};

export const assertLatexAssetStorageKey = (
    teamId: string,
    documentId: string,
    storageKey: string
): void => {
    if (storageKey.startsWith(buildAssetPrefix(teamId, documentId))) {
        return;
    }

    throw ApplicationError.forbidden(
        'LatexAsset::StorageKeyForbidden',
        'Asset key is outside the document storage scope'
    );
};

export const buildLatexAssetContentUrl = (
    teamId: string,
    documentId: string,
    storageKey: string
): string => {
    const encodedTeamId = encodeURIComponent(teamId);
    const encodedDocumentId = encodeURIComponent(documentId);
    const encodedKey = encodeURIComponent(storageKey);
    return `/api/latex/${encodedTeamId}/documents/${encodedDocumentId}/assets/content?key=${encodedKey}`;
};

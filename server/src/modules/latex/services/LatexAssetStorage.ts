import type { LatexDocumentStorageScope } from '@modules/latex/contracts/latex-document';
import ApplicationError from '@shared/application/errors/ApplicationError';
import path from 'node:path';

export const buildLatexAssetStoragePrefix = (teamId: string, documentId: string): string => {
    return `latex-assets/${teamId}/${documentId}/`;
};

export const requireLatexStorageClusterId = (
    documentId: string,
    document: LatexDocumentStorageScope
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
    return `${buildLatexAssetStoragePrefix(teamId, documentId)}${uniqueId}${ext}`;
};

export const assertLatexAssetStorageKey = (
    teamId: string,
    documentId: string,
    storageKey: string
): void => {
    if (!storageKey) {
        throw ApplicationError.badRequest(
            'LatexAsset::StorageKeyRequired',
            'The "key" query parameter is required'
        );
    }

    if (storageKey.startsWith(buildLatexAssetStoragePrefix(teamId, documentId))) {
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
    return `/api/teams/${encodedTeamId}/latex-documents/${encodedDocumentId}/assets/content?key=${encodedKey}`;
};

export const sanitizeAssetPath = (assetPath: string, originalName: string): string => {
    const normalized = assetPath.replace(/\\/g, '/');
    const segments = normalized
        .split('/')
        .filter((seg) => seg.length > 0 && seg !== '.');

    const safe: string[] = [];
    for (const seg of segments) {
        if (seg === '..') {
            safe.pop();
        } else {
            safe.push(seg);
        }
    }

    const result = safe.join('/');
    if (!result) {
        return path.basename(originalName);
    }

    return result;
};

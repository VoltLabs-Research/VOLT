import {
    latexAssetsQuery,
    useDeleteLatexAssetMutation,
    useUploadLatexAssetMutation,
    useUpdateLatexAssetMutation
} from '@/modules/latex/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import { buildFolderPlaceholderPath, getAssetDisplayName, isFolderPlaceholderAsset, LATEX_FOLDER_PLACEHOLDER_NAME } from '@/modules/latex/utilities/workspace';
import { useCallback, useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';
import type { FileWithPath } from '@/shared/utils/file';

interface UseLatexAssetsInput {
    documentId: string;
    onInsertRef?: (ref: string) => void;
};

const DELETE_TOAST = {
    loading: { title: 'Deleting asset...' },
    success: { title: 'Asset deleted' },
    error: { title: 'Failed to delete asset' }
};

export const buildLatexRef = (asset: LatexAsset): string => {
    const isImage = asset.mimetype.startsWith('image/');
    const isPdf = asset.mimetype === 'application/pdf';
    const refPath = asset.path;
    const nameNoExt = refPath.replace(/\.[^.]+$/, '');

    if (isImage) {
        return `\\includegraphics[width=\\linewidth]{${refPath}}`;
    }

    if (isPdf) {
        return `\\includepdf[pages=-]{${refPath}}`;
    }

    return `% Asset: ${nameNoExt} - ${asset.url}`;
};

const RENAME_TOAST = {
    loading: { title: 'Renaming file...' },
    success: { title: 'File renamed' },
    error: { title: 'Failed to rename file' }
};

const CREATE_FOLDER_TOAST = {
    loading: { title: 'Creating folder...' },
    success: { title: 'Folder created' },
    error: { title: 'Failed to create folder' }
};

/** Manages asset listing, upload, deletion, move, and editor insertion for a LaTeX document. */
const useLatexAssets = ({ documentId, onInsertRef }: UseLatexAssetsInput) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const assetsQueryResult = latexAssetsQuery({ documentId }, { enabled: !!documentId });
    const assets = assetsQueryResult.data ?? [];
    const isLoadingAssets = assetsQueryResult.isLoading;

    const { mutateAsync: uploadAsset, isPending: isUploading } = useUploadLatexAssetMutation();
    const { mutateAsync: deleteAsset } = useDeleteLatexAssetMutation();
    const { mutateAsync: updateAsset } = useUpdateLatexAssetMutation();

    const visibleAssets = assets.filter((asset) => !isFolderPlaceholderAsset(asset));

    const uploadSingleAsset = useCallback(async (entry: FileWithPath) => {
        const result = await uploadAsset({
            documentId,
            files: [entry.file],
            path: entry.path
        });

        if (result.uploaded.length === 0) {
            throw new Error(`Failed to upload ${entry.path}`);
        }
    }, [documentId, uploadAsset]);

    const handleUploadEntries = useCallback(async (entries: FileWithPath[]) => {
        if (entries.length === 0) {
            return;
        }

        const totalCount = entries.length;
        const isSingle = totalCount === 1;

        await showPromise(
            Promise.all(entries.map((entry) => uploadSingleAsset(entry))),
            {
                loading: { title: isSingle ? 'Uploading file...' : `Uploading ${totalCount} files...` },
                success: { title: isSingle ? 'File uploaded' : `${totalCount} files uploaded` },
                error: {
                    title: isSingle ? 'Failed to upload file' : 'Failed to upload files',
                    description: 'One or more files could not be uploaded.'
                }
            }
        );
    }, [uploadSingleAsset]);

    const handleFileSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList).map((file) => ({
            file,
            path: file.name
        }));
        event.target.value = '';

        await handleUploadEntries(files);
    }, [handleUploadEntries]);

    const handleFolderSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList).map((file) => ({
            file,
            path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
        }));
        event.target.value = '';

        await handleUploadEntries(files);
    }, [handleUploadEntries]);

    const handleUploadClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleUploadFolderClick = useCallback(() => {
        folderInputRef.current?.click();
    }, []);

    const handleDeleteAsset = useCallback(async (asset: LatexAsset) => {
        const isConfirmed = await confirm({
            title: 'Delete asset',
            description: `Are you sure you want to delete "${getAssetDisplayName(asset)}"? This cannot be undone.`
        });

        if (!isConfirmed) return;

        await showPromise(
            deleteAsset({ documentId, assetId: asset._id }),
            DELETE_TOAST
        );
    }, [confirm, deleteAsset, documentId]);

    const handleInsertRef = useCallback((asset: LatexAsset) => {
        onInsertRef?.(buildLatexRef(asset));
    }, [onInsertRef]);

    const handleRenameAsset = useCallback(async (asset: LatexAsset, name: string): Promise<void> => {
        const currentPath = asset.path;
        const { path } = (() => {
            const normalized = currentPath.replace(/\\/g, '/');
            const index = normalized.lastIndexOf('/');
            return { path: index >= 0 ? normalized.slice(0, index + 1) : '' };
        })();

        await showPromise(
            updateAsset({ documentId, assetId: asset._id, path: `${path}${name}` }),
            RENAME_TOAST
        );
    }, [documentId, updateAsset]);

    const handleCreateFolder = useCallback(async (folderPath: string): Promise<void> => {
        const placeholder = new File(['folder'], LATEX_FOLDER_PLACEHOLDER_NAME, {
            type: 'application/octet-stream'
        });

        await showPromise(
            uploadSingleAsset({
                file: placeholder,
                path: buildFolderPlaceholderPath(folderPath)
            }),
            CREATE_FOLDER_TOAST
        );
    }, [uploadSingleAsset]);

    return {
        assets: visibleAssets,
        rawAssets: assets,
        isLoadingAssets,
        isUploading,
        fileInputRef,
        folderInputRef,
        handleUploadClick,
        handleUploadFolderClick,
        handleFileSelected,
        handleFolderSelected,
        handleUploadEntries,
        handleDeleteAsset,
        handleInsertRef,
        handleRenameAsset,
        handleCreateFolder,
        deleteAsset,
        updateAsset
    };
};

export default useLatexAssets;

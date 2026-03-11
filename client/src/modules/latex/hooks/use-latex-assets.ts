import {
    latexAssetsQuery,
    useDeleteLatexAssetMutation,
    useUploadLatexAssetMutation,
    useUpdateLatexAssetMutation
} from '@/modules/latex/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { sileo } from 'sileo';
import { useCallback, useRef } from 'react';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';

interface UseLatexAssetsInput {
    documentId: string;
    onInsertRef?: (ref: string) => void;
};

const DELETE_TOAST = {
    loading: { title: 'Deleting asset...' },
    success: { title: 'Asset deleted' },
    error: { title: 'Failed to delete asset' }
};

const MOVE_TOAST = {
    loading: { title: 'Moving asset...' },
    success: { title: 'Asset moved' },
    error: { title: 'Failed to move asset' }
};

const buildLatexRef = (asset: LatexAsset): string => {
    const isImage = asset.mimetype.startsWith('image/');
    const isPdf = asset.mimetype === 'application/pdf';
    // Use the stored path when available so the reference matches the directory
    // structure reconstructed during compilation. Fall back to originalName for
    // legacy assets that pre-date path support.
    const refPath = asset.path ?? asset.originalName;
    const nameNoExt = refPath.replace(/\.[^.]+$/, '');

    if (isImage) {
        return `\\includegraphics[width=\\linewidth]{${refPath}}`;
    }

    if (isPdf) {
        return `\\includepdf[pages=-]{${refPath}}`;
    }

    return `% Asset: ${nameNoExt} - ${asset.url}`;
};

/** Manages asset listing, upload, deletion, move, and editor insertion for a LaTeX document. */
const useLatexAssets = ({ documentId, onInsertRef }: UseLatexAssetsInput) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { confirm } = useConfirm();

    const assetsQueryResult = latexAssetsQuery({ documentId }, { enabled: !!documentId });
    const assets = assetsQueryResult.data ?? [];
    const isLoadingAssets = assetsQueryResult.isLoading;

    const { mutateAsync: uploadAsset, isPending: isUploading } = useUploadLatexAssetMutation();
    const { mutateAsync: deleteAsset } = useDeleteLatexAssetMutation();
    const { mutateAsync: updateAsset } = useUpdateLatexAssetMutation();

    const handleUploadClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const allFiles = Array.from(fileList);
        event.target.value = '';

        const texFiles = allFiles.filter((f) => f.name.toLowerCase().endsWith('.tex'));
        const files = allFiles.filter((f) => !f.name.toLowerCase().endsWith('.tex'));

        if (texFiles.length > 0) {
            sileo.warning({
                title: '.tex files cannot be uploaded here',
                description: 'Use the "New file" button in the file tree to create or import .tex files.'
            });
        }

        if (files.length === 0) return;

        const totalCount = files.length;
        const isSingle = totalCount === 1;

        // Reject the promise when zero files were accepted so showPromise routes
        // to the error toast instead of showing a misleading success message.
        const uploadPromise = uploadAsset({ documentId, files }).then((result) => {
            if (result.uploaded.length === 0) {
                throw new Error('All uploads failed');
            }
            return result;
        });

        await showPromise(uploadPromise, {
            loading: { title: isSingle ? 'Uploading asset...' : `Uploading ${totalCount} assets...` },
            success: (result) => {
                const successCount = result.uploaded.length;
                if (result.failedCount > 0) {
                    const failWord = result.failedCount === 1 ? 'asset' : 'assets';
                    return {
                        title: `${successCount} of ${totalCount} uploaded`,
                        description: `${result.failedCount} ${failWord} could not be uploaded`
                    };
                }
                return { title: isSingle ? 'Asset uploaded' : `${successCount} assets uploaded` };
            },
            error: {
                title: isSingle ? 'Failed to upload asset' : 'Failed to upload assets',
                description: 'Files may be too large or unsupported.'
            }
        });
    }, [documentId, uploadAsset]);

    const handleDeleteAsset = useCallback(async (asset: LatexAsset) => {
        const isConfirmed = await confirm({
            title: 'Delete asset',
            description: `Are you sure you want to delete "${asset.originalName}"? This cannot be undone.`
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

    /**
     * Moves an asset to a new virtual folder by updating its `path`.
     *
     * @param assetId     - The ID of the asset to move.
     * @param folderPath  - Target folder prefix, e.g. `"images/"`. Pass the originalName to keep at root.
     */
    const handleMoveAsset = useCallback(async (assetId: string, newPath: string): Promise<void> => {
        await showPromise(
            updateAsset({ documentId, assetId, path: newPath }),
            MOVE_TOAST
        );
    }, [documentId, updateAsset]);

    return {
        assets,
        isLoadingAssets,
        isUploading,
        fileInputRef,
        handleUploadClick,
        handleFileSelected,
        handleDeleteAsset,
        handleInsertRef,
        handleMoveAsset
    };
};

export default useLatexAssets;

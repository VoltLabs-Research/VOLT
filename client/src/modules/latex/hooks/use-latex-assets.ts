import {
    latexAssetsQuery,
    useDeleteLatexAssetMutation,
    useUploadLatexAssetMutation
} from '@/modules/latex/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { useCallback, useRef } from 'react';
import type { LatexAsset } from '@/modules/latex/api/entities/latex-asset';

interface UseLatexAssetsInput {
    documentId: string;
    onInsertRef?: (ref: string) => void;
};

const UPLOAD_TOAST = {
    loading: { title: 'Uploading asset...' },
    success: { title: 'Asset uploaded' },
    error: { title: 'Failed to upload asset' }
};

const DELETE_TOAST = {
    loading: { title: 'Deleting asset...' },
    success: { title: 'Asset deleted' },
    error: { title: 'Failed to delete asset' }
};

const buildLatexRef = (asset: LatexAsset): string => {
    const isImage = asset.mimetype.startsWith('image/');
    const name = asset.originalName.replace(/\.[^.]+$/, '');

    if (isImage) {
        return `\\includegraphics[width=\\linewidth]{${asset.originalName}}`;
    }

    return `% Asset: ${name} - ${asset.url}`;
};

/** Manages asset listing, upload, deletion and editor insertion for a LaTeX document. */
const useLatexAssets = ({ documentId, onInsertRef }: UseLatexAssetsInput) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { confirm } = useConfirm();

    const assetsQueryResult = latexAssetsQuery({ documentId }, { enabled: !!documentId });
    const assets = assetsQueryResult.data ?? [];
    const isLoadingAssets = assetsQueryResult.isLoading;

    const { mutateAsync: uploadAsset, isPending: isUploading } = useUploadLatexAssetMutation();
    const { mutateAsync: deleteAsset } = useDeleteLatexAssetMutation();

    const handleUploadClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        event.target.value = '';

        await showPromise(
            uploadAsset({ documentId, file }),
            UPLOAD_TOAST
        );
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

    return {
        assets,
        isLoadingAssets,
        isUploading,
        fileInputRef,
        handleUploadClick,
        handleFileSelected,
        handleDeleteAsset,
        handleInsertRef
    };
};

export default useLatexAssets;

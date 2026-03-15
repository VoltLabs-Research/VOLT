import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { sileo } from 'sileo';
import type { IEntrypointData } from '@/modules/plugin/api/entities/plugin/workflow';
import { useDeleteBinaryMutation, useUploadBinaryMutation } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { isAccessDeniedError, reportError, ErrorSurface } from '@/shared/errors/core';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { EntrypointEditorFormValues } from './schema';

const UPLOAD_ACCESS_DENIED_MESSAGE = 'You do not have permission to upload binaries';
const DELETE_ACCESS_DENIED_MESSAGE = 'You do not have permission to delete binaries';

export const useEntrypointBinaryActions = (
    nodeId: string,
    form: UseFormReturn<EntrypointEditorFormValues>
) => {
    const { searchParams } = useSearchParamsState();
    const currentPluginId = searchParams.get('id');
    const selectedTeamId = useSelectedTeamId();
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const uploadBinaryMutation = useUploadBinaryMutation();
    const deleteBinaryMutation = useDeleteBinaryMutation();

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updateEntrypointData = useCallback((data: EntrypointEditorFormValues) => {
        form.reset(data);
        updateNodeData(nodeId, { entrypoint: data as IEntrypointData });
    }, [form, nodeId, updateNodeData]);

    const setAccessDeniedError = useCallback((error: unknown, fallbackMessage: string) => {
        const userError = reportError(error, { surface: ErrorSurface.Toast, fallbackTitle: fallbackMessage });
        setUploadError(userError.title || fallbackMessage);
    }, []);

    const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!currentPluginId) {
            setUploadError('Please save the plugin first before uploading a binary');
            return;
        }

        if (!selectedTeamId) {
            setUploadError('Select a team before uploading a binary');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError(null);

        try {
            const result = await uploadBinaryMutation.mutateAsync({
                pluginId: currentPluginId,
                teamId: selectedTeamId,
                file,
                onProgress: (progress: number) => setUploadProgress(Math.round(progress * 100))
            });

            const currentValues = form.getValues();
            updateEntrypointData({
                ...currentValues,
                binary: file.name,
                binaryObjectPath: result.objectPath,
                binaryFileName: result.fileName
            });
            setUploadProgress(100);
            sileo.success({ title: 'Binary uploaded successfully' });
        } catch (error) {
            if (isAccessDeniedError(error)) {
                setAccessDeniedError(error, UPLOAD_ACCESS_DENIED_MESSAGE);
                return;
            }

            setUploadError(error instanceof Error ? error.message : 'Failed to upload binary');
        } finally {
            setIsUploading(false);
        }
    }, [currentPluginId, selectedTeamId, uploadBinaryMutation, form, updateEntrypointData, setAccessDeniedError]);

    const handleRemoveBinary = useCallback(async () => {
        const currentValues = form.getValues();

        if (!currentPluginId || !currentValues.binaryObjectPath) {
            return;
        }

        try {
            await showPromise(deleteBinaryMutation.mutateAsync({ pluginId: currentPluginId }), {
                loading: { title: 'Removing binary...' },
                success: { title: 'Binary removed' },
                error: { title: 'Failed to remove binary' }
            });

            updateEntrypointData({
                ...currentValues,
                binary: '',
                binaryObjectPath: undefined,
                binaryFileName: undefined
            });
        } catch (error) {
            if (isAccessDeniedError(error)) {
                setAccessDeniedError(error, DELETE_ACCESS_DENIED_MESSAGE);
                return;
            }

            setUploadError(error instanceof Error ? error.message : 'Failed to delete binary');
        }
    }, [currentPluginId, form, deleteBinaryMutation, updateEntrypointData, setAccessDeniedError]);

    const triggerFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    return {
        currentPluginId,
        fileInputRef,
        handleFileSelect,
        handleRemoveBinary,
        triggerFileSelect,
        isUploading,
        uploadProgress,
        uploadError
    };
};

export default useEntrypointBinaryActions;

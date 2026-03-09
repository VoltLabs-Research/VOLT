import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { TbUpload, TbFile, TbTrash, TbCheck } from 'react-icons/tb';
import { useUploadBinaryMutation, useDeleteBinaryMutation } from '@/modules/plugin/hooks/plugin/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useNodeFormRHF from '@/modules/plugin/hooks/plugin/use-node-form-rhf';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { getAccessDeniedMessage, notifyApiError, isAccessDeniedError } from '@/shared/errors/notify-api-error';
import { z } from 'zod/v4';
import type { IEntrypointData } from '@/modules/plugin/api/entities/plugin/workflow';
import type { EditorProps } from '../types';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import './EntrypointEditor.css';

const entrypointEditorSchema = z.object({
    binary: z.string().default(''),
    binaryObjectPath: z.string().optional(),
    binaryFileName: z.string().optional(),
    binaryHash: z.string().optional(),
    arguments: z.string().default(''),
    timeout: z.union([z.number(), z.string()]).optional()
}).strict();

type EntrypointEditorFormValues = z.infer<typeof entrypointEditorSchema>;

const DEFAULT_VALUES: EntrypointEditorFormValues = {
    binary: '',
    arguments: ''
};

const EntrypointEditor = ({ node }: EditorProps) => {
    const form = useNodeFormRHF<EntrypointEditorFormValues>({
        schema: entrypointEditorSchema,
        nodeId: node.id,
        dataKey: 'entrypoint',
        node,
        defaultValue: DEFAULT_VALUES
    });
    const { searchParams } = useSearchParamsState();
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);
    const currentPluginId = searchParams.get('id');
    const selectedTeamId = useSelectedTeamId();
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const uploadBinaryMutation = useUploadBinaryMutation();
    const deleteBinaryMutation = useDeleteBinaryMutation();

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

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
            const newData = {
                ...currentValues,
                binary: file.name,
                binaryObjectPath: result.objectPath,
                binaryFileName: result.fileName
            };
            form.reset(newData);
            updateNodeData(node.id, { entrypoint: newData as IEntrypointData });
            setUploadProgress(100);
            sileo.success({ title: 'Binary uploaded successfully' });
        } catch (error) {
            if(isAccessDeniedError(error)){
                notifyApiError(error, { fallbackTitle: 'You do not have permission to upload binaries' });
                setUploadError(getAccessDeniedMessage(error, 'You do not have permission to upload binaries') ?? 'You do not have permission to upload binaries');
                return;
            }
            setUploadError(error instanceof Error ? error.message : 'Failed to upload binary');
        } finally {
            setIsUploading(false);
        }
    }, [currentPluginId, selectedTeamId, uploadBinaryMutation, form, updateNodeData, node.id]);

    const handleRemoveBinary = useCallback(async () => {
        const currentValues = form.getValues();
        if (!currentPluginId || !currentValues.binaryObjectPath) return;

        try {
            await showPromise(deleteBinaryMutation.mutateAsync({ pluginId: currentPluginId }), {
                loading: { title: 'Removing binary...' },
                success: { title: 'Binary removed' },
                error: { title: 'Failed to remove binary' }
            });
            const newData = {
                ...currentValues,
                binary: '',
                binaryObjectPath: undefined,
                binaryFileName: undefined
            };
            form.reset(newData);
            updateNodeData(node.id, { entrypoint: newData as IEntrypointData });
        } catch (error) {
            if(isAccessDeniedError(error)){
                notifyApiError(error, { fallbackTitle: 'You do not have permission to delete binaries' });
                setUploadError(getAccessDeniedMessage(error, 'You do not have permission to delete binaries') ?? 'You do not have permission to delete binaries');
                return;
            }
            setUploadError(error instanceof Error ? error.message : 'Failed to delete binary');
        }
    }, [currentPluginId, form, deleteBinaryMutation, updateNodeData, node.id]);

    const triggerFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const watchedBinaryObjectPath = form.watch('binaryObjectPath');
    const watchedBinaryFileName = form.watch('binaryFileName');
    const watchedBinary = form.watch('binary');

    return (
        <>
            <CollapsibleSection title='Binary' defaultExpanded>
                <Container className='d-flex column gap-05 binary-upload-container'>
                    <input
                        ref={fileInputRef}
                        type='file'
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />

                    {watchedBinaryObjectPath ? (
                        <Container className='d-flex items-center content-between binary-uploaded'>
                            <Container className='d-flex items-center gap-05 binary-file-info'>
                                <TbFile size={20} />
                                <span className='binary-filename overflow-hidden font-size-2 font-weight-5'>
                                    {watchedBinaryFileName || watchedBinary}
                                </span>
                                <TbCheck size={16} className='binary-check-icon' />
                            </Container>
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                onClick={handleRemoveBinary}
                            >
                                <TbTrash size={16} />
                            </Button>
                        </Container>
                    ) : (
                        <Button
                            variant='outline'
                            intent='neutral'
                            size='sm'
                            leftIcon={<TbUpload size={18} />}
                            onClick={triggerFileSelect}
                            disabled={isUploading || !currentPluginId}
                        >
                            {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload Binary'}
                        </Button>
                    )}

                    {!currentPluginId && (
                        <Paragraph className='binary-upload-hint font-size-1'>
                            Save the plugin first (Ctrl+S) to enable binary upload
                        </Paragraph>
                    )}

                    {uploadError && (
                        <Paragraph className='binary-upload-error font-size-1'>{uploadError}</Paragraph>
                    )}

                    {isUploading && (
                        <Container className='binary-upload-progress w-max overflow-hidden'>
                            <div
                                className='binary-upload-progress-bar h-max'
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </Container>
                    )}
                </Container>
            </CollapsibleSection>

            <CollapsibleSection title='Execution' defaultExpanded>
                <FormFieldRHF<EntrypointEditorFormValues>
                    variant='inline'
                    label='Arguments'
                    fieldType='textarea'
                    name='arguments'
                    control={form.control}
                    placeholder='{{ forEach.currentValue }} --output {{ forEach.outputPath }}'
                    rows={3}
                    autocomplete={{ options: nodeReferenceOptions }}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Options'>
                <FormFieldRHF<EntrypointEditorFormValues>
                    variant='inline'
                    label='Timeout (ms)'
                    fieldType='input'
                    name='timeout'
                    control={form.control}
                    inputProps={{ type: 'number' }}
                    placeholder='30000'
                />
            </CollapsibleSection>
        </>
    );
};

export default EntrypointEditor;

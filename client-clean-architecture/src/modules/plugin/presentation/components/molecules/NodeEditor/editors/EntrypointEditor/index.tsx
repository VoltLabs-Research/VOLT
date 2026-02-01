import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { TbUpload, TbFile, TbTrash, TbCheck } from 'react-icons/tb';
import { useNodeForm, usePluginUseCases } from '@/modules/plugin/presentation/hooks';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import type { IEntrypointData } from '@/modules/plugin/domain/entities';
import './EntrypointEditor.css';

interface EntrypointEditorProps {
    node: Node;
};

const DEFAULT_ENTRYPOINT: IEntrypointData = {
    binary: '',
    arguments: ''
};

const EntrypointEditor = ({ node }: EntrypointEditorProps) => {
    const { field, values, setValues } = useNodeForm(node, 'entrypoint', DEFAULT_ENTRYPOINT);
    const currentPluginId = usePluginBuilderStore((state) => state.currentPluginId);
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const { uploadBinaryUseCase, deleteBinaryUseCase } = usePluginUseCases();

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

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError(null);

        try {
            const result = await uploadBinaryUseCase.execute({
                pluginId: currentPluginId,
                file,
                onProgress: (progress: number) => setUploadProgress(progress)
            });

            if (result) {
                const newData = {
                    ...values,
                    binary: file.name,
                    binaryObjectPath: result.objectPath,
                    binaryFileName: result.fileName
                };
                setValues(newData);
                updateNodeData(node.id, { entrypoint: newData });
            }

            setUploadProgress(100);
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'Failed to upload binary');
        } finally {
            setIsUploading(false);
        }
    }, [currentPluginId, uploadBinaryUseCase, values, setValues, updateNodeData, node.id]);

    const handleRemoveBinary = useCallback(async () => {
        if (!currentPluginId || !values.binaryObjectPath) return;

        try {
            await deleteBinaryUseCase.execute({ pluginId: currentPluginId });
            const newData = {
                ...values,
                binary: '',
                binaryObjectPath: undefined,
                binaryFileName: undefined
            };
            setValues(newData);
            updateNodeData(node.id, { entrypoint: newData });
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'Failed to delete binary');
        }
    }, [currentPluginId, values, deleteBinaryUseCase, setValues, updateNodeData, node.id]);

    const triggerFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

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

                    {values.binaryObjectPath ? (
                        <Container className='d-flex items-center content-between binary-uploaded'>
                            <Container className='d-flex items-center gap-05 binary-file-info'>
                                <TbFile size={20} />
                                <span className='binary-filename overflow-hidden font-size-2 font-weight-5'>
                                    {values.binaryFileName || values.binary}
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
                <FormField
                    variant='inline'
                    label='Arguments'
                    fieldType='textarea'
                    {...field('arguments')}
                    placeholder='{{ forEach.currentValue }} --output {{ forEach.outputPath }}'
                    rows={3}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Options'>
                <FormField
                    variant='inline'
                    label='Timeout (ms)'
                    fieldType='input'
                    {...field('timeout')}
                    inputProps={{ type: 'number' }}
                    placeholder='30000'
                />
            </CollapsibleSection>
        </>
    );
};

export default EntrypointEditor;

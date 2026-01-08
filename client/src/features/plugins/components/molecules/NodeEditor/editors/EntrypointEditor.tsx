import React, { useCallback, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import useConfirm from '@/hooks/ui/use-confirm';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import { useNodeData } from '@/features/plugins/hooks/use-node-data';
import type { IEntrypointData } from '@/types/plugin';
import pluginApi from '@/features/plugins/api/plugin';
import { usePluginBuilderStore } from '@/features/plugins/stores/builder-slice';
import Button from '@/components/primitives/Button';
import Tooltip from '@/components/atoms/common/Tooltip';
import { TbUpload, TbFile, TbTrash, TbCheck } from 'react-icons/tb';
import Paragraph from '@/components/primitives/Paragraph';
import './EntrypointEditor.css';

interface EntrypointEditorProps {
    node: Node;
}

const DEFAULT_ENTRYPOINT: Partial<IEntrypointData> = {
    binary: '',
    arguments: ''
};

const EntrypointEditor: React.FC<EntrypointEditorProps> = ({ node }) => {
    const { confirm } = useConfirm();
    const { data: entrypoint, updateField, updateData, nodeId } = useNodeData(node, 'entrypoint', DEFAULT_ENTRYPOINT);
    const currentPlugin = usePluginBuilderStore((state) => state.currentPlugin);

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!currentPlugin?._id) {
            setUploadError('Please save the plugin first before uploading a binary');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError(null);

        try {
            const result = await pluginApi.uploadBinary(
                currentPlugin._id,
                file,
                (progress) => setUploadProgress(progress)
            );

            // Update all binary fields at once to ensure consistency
            updateData({
                binary: file.name,
                binaryObjectPath: result.objectPath,
                binaryFileName: result.fileName
            });

            setUploadProgress(100);
        } catch (error: any) {
            setUploadError(error.message || 'Failed to upload binary');
        } finally {
            setIsUploading(false);
        }
    }, [currentPlugin?._id, updateData]);

    const handleRemoveBinary = useCallback(async () => {
        if (!currentPlugin?._id || !entrypoint.binaryObjectPath) return;

        if (!await confirm('Are you sure you want to delete this binary?')) return;

        try {
            await pluginApi.deleteBinary(currentPlugin._id);
            // Clear all binary fields at once
            updateData({
                binary: '',
                binaryObjectPath: undefined,
                binaryFileName: undefined
            });
        } catch (error: any) {
            setUploadError(error.message || 'Failed to delete binary');
        }
    }, [currentPlugin?._id, entrypoint.binaryObjectPath, updateData]);

    const triggerFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    return (
        <>
            <CollapsibleSection title='Binary' defaultExpanded>
                <div className='d-flex column gap-05 binary-upload-container'>
                    <input
                        ref={fileInputRef}
                        type='file'
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />

                    {entrypoint.binaryObjectPath ? (
                        <div className='d-flex items-center content-between binary-uploaded'>
                            <div className='d-flex items-center gap-05 binary-file-info'>
                                <TbFile size={20} />
                                <span className='binary-filename overflow-hidden font-size-2 font-weight-5'>{entrypoint.binaryFileName || entrypoint.binary}</span>
                                <TbCheck size={16} className='binary-check-icon' />
                            </div>
                            <Tooltip content="Remove Binary" placement="left">
                                <Button
                                    variant='ghost'
                                    intent='danger'
                                    iconOnly
                                    size='sm'
                                    className='binary-remove-btn cursor-pointer'
                                    onClick={handleRemoveBinary}
                                >
                                    <TbTrash size={16} />
                                </Button>
                            </Tooltip>
                        </div>
                    ) : (
                        <Button
                            variant='outline'
                            intent='neutral'
                            size='sm'
                            className='binary-upload-btn font-size-2 font-weight-5 cursor-pointer'
                            onClick={triggerFileSelect}
                            disabled={isUploading || !currentPlugin?._id}
                            leftIcon={<TbUpload size={18} />}
                        >
                            {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload Binary'}
                        </Button>
                    )}

                    {!currentPlugin?._id && (
                        <Paragraph className='binary-upload-hint font-size-1'>
                            Save the plugin first(Ctrl+S) to enable binary upload
                        </Paragraph>
                    )}

                    {uploadError && (
                        <Paragraph className='binary-upload-error font-size-1'>{uploadError}</Paragraph>
                    )}

                    {isUploading && (
                        <div className='binary-upload-progress w-max overflow-hidden'>
                            <div
                                className='binary-upload-progress-bar h-max'
                                style={{ width: `${uploadProgress}% ` }}
                            />
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title='Execution' defaultExpanded>
                <FormField
                    label='Command Arguments'
                    fieldKey='arguments'
                    fieldType='input'
                    fieldValue={entrypoint.arguments || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: '{{ forEach.currentValue }} --output {{ forEach.outputPath }}' }}
                    expressionEnabled
                    expressionNodeId={nodeId}
                    expressionMultiline
                    expressionRows={3}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Options'>
                <FormField
                    label='Timeout(ms)'
                    fieldKey='timeout'
                    fieldType='input'
                    fieldValue={entrypoint.timeout ?? ''}
                    onFieldChange={(key, value) => updateField(key, Number(value) || undefined)}
                    inputProps={{ type: 'number', placeholder: '30000' }}
                />
            </CollapsibleSection>
        </>
    );
};

export default EntrypointEditor;

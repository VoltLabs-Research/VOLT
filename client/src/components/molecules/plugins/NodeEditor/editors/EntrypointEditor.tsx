import React, { useCallback, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import { useNodeData } from '@/hooks/plugins/use-node-data';
import type { IEntrypointData } from '@/types/plugin';
import pluginApi from '@/services/plugin-api';
import usePluginBuilderStore from '@/stores/plugins/plugin-builder';
import { TbUpload, TbFile, TbTrash, TbCheck } from 'react-icons/tb';
import './EntrypointEditor.css';

interface EntrypointEditorProps {
    node: Node;
}

const DEFAULT_ENTRYPOINT: Partial<IEntrypointData> = {
    binary: '',
    arguments: ''
};

const EntrypointEditor: React.FC<EntrypointEditorProps> = ({ node }) => {
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

        try {
            await pluginApi.deleteBinary(currentPlugin._id, entrypoint.binaryObjectPath);
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
                <div className='binary-upload-container'>
                    <input
                        ref={fileInputRef}
                        type='file'
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />

                    {entrypoint.binaryObjectPath ? (
                        <div className='binary-uploaded'>
                            <div className='binary-file-info'>
                                <TbFile size={20} />
                                <span className='binary-filename'>{entrypoint.binaryFileName || entrypoint.binary}</span>
                                <TbCheck size={16} className='binary-check-icon' />
                            </div>
                            <button
                                className='binary-remove-btn'
                                onClick={handleRemoveBinary}
                                title='Remove binary'
                            >
                                <TbTrash size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            className='binary-upload-btn'
                            onClick={triggerFileSelect}
                            disabled={isUploading || !currentPlugin?._id}
                        >
                            <TbUpload size={18} />
                            <span>{isUploading ? `Uploading... ${uploadProgress}%` : 'Upload Binary'}</span>
                        </button>
                    )}

                    {!currentPlugin?._id && (
                        <p className='binary-upload-hint'>
                            Save the plugin first (Ctrl+S) to enable binary upload
                        </p>
                    )}

                    {uploadError && (
                        <p className='binary-upload-error'>{uploadError}</p>
                    )}

                    {isUploading && (
                        <div className='binary-upload-progress'>
                            <div
                                className='binary-upload-progress-bar'
                                style={{ width: `${uploadProgress}%` }}
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
                    label='Timeout (ms)'
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

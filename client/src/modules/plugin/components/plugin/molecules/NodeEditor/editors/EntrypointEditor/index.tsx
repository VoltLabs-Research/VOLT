import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { TbUpload, TbFile, TbTrash, TbCheck } from 'react-icons/tb';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import { createNodeEditorForm } from '@/shared/forms';
import type { EditorProps } from '../types';
import { ENTRYPOINT_EDITOR_DEFAULT_VALUES, entrypointEditorSchema, type EntrypointEditorFormValues } from './schema';
import useEntrypointBinaryActions from './use-entrypoint-binary-actions';
import './EntrypointEditor.css';

const useEntrypointEditorForm = createNodeEditorForm<EntrypointEditorFormValues, 'entrypoint'>({
    schema: entrypointEditorSchema,
    defaults: ENTRYPOINT_EDITOR_DEFAULT_VALUES,
    dataKey: 'entrypoint'
});

const EntrypointEditor = ({ node }: EditorProps) => {
    const form = useEntrypointEditorForm(node);
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);
    const {
        currentPluginId,
        fileInputRef,
        handleFileSelect,
        handleRemoveBinary,
        triggerFileSelect,
        isUploading,
        uploadProgress,
        uploadError
    } = useEntrypointBinaryActions(node.id, form);

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

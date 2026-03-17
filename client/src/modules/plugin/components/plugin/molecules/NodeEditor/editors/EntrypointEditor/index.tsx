import Button from '@/shared/presentation/components/Button';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Paragraph from '@/shared/presentation/components/Paragraph';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import { EntrypointType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { createNodeEditorForm } from '@/shared/forms';
import { applyMonacoTheme, getMonacoThemeName } from '@/shared/presentation/utilities/ensure-monaco';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/app-theme';
import Editor from '@monaco-editor/react';
import { useEffect, useMemo, useState } from 'react';
import { TbUpload, TbFile, TbTrash, TbCheck } from 'react-icons/tb';
import { ENTRYPOINT_EDITOR_DEFAULT_VALUES, entrypointEditorSchema, type EntrypointEditorFormValues } from './schema';
import useEntrypointBinaryActions from './use-entrypoint-binary-actions';
import type { EditorProps } from '../types';
import './EntrypointEditor.css';

const ENTRYPOINT_TYPE_OPTIONS = [{
    value: EntrypointType.EXECUTABLE,
    title: 'Executable'
}, {
    value: EntrypointType.PYTHON_SCRIPT,
    title: 'Python Script'
}];

const useEntrypointEditorForm = createNodeEditorForm<EntrypointEditorFormValues, 'entrypoint'>({
    schema: entrypointEditorSchema,
    defaults: ENTRYPOINT_EDITOR_DEFAULT_VALUES,
    dataKey: 'entrypoint'
});

const EntrypointEditor = ({ node }: EditorProps) => {
    const form = useEntrypointEditorForm(node);
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);
    const [monacoTheme, setMonacoTheme] = useState(() => getMonacoThemeName(getActiveAppTheme()));
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
    const watchedEntrypointType = form.watch('type') ?? EntrypointType.EXECUTABLE;
    const watchedRequirementsFile = form.watch('requirementsFile') ?? '';
    const watchedEntrypointScript = form.watch('entrypointScript') ?? '';
    const isPythonScript = watchedEntrypointType === EntrypointType.PYTHON_SCRIPT;
    const isProjectMode = isPythonScript && watchedEntrypointScript.length > 0;
    const binarySectionTitle = isPythonScript
        ? (isProjectMode ? 'Project' : 'Script')
        : 'Binary';
    const uploadButtonLabel = isPythonScript
        ? (isProjectMode ? 'Upload Project (ZIP)' : 'Upload Script')
        : 'Upload Binary';

    useEffect(() => {
        if (!form.getValues('type')) {
            form.setValue('type', EntrypointType.EXECUTABLE, { shouldDirty: false });
        }

        if (typeof form.getValues('requirementsFile') !== 'string') {
            form.setValue('requirementsFile', '', { shouldDirty: false });
        }
    }, [form]);

    useEffect(() => {
        applyMonacoTheme();

        return subscribeToAppTheme((theme) => {
            setMonacoTheme(getMonacoThemeName(theme));
            applyMonacoTheme(theme);
        });
    }, []);

    const monacoOptions = useMemo(() => ({
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        lineNumbers: 'off' as const,
        wordWrap: 'off' as const,
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 8,
        overviewRulerLanes: 0,
        padding: {
            top: 12,
            bottom: 12
        }
    }), []);

    return (
        <>
            <CollapsibleSection title={binarySectionTitle} defaultExpanded>
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
                            {isUploading ? `Uploading... ${uploadProgress}%` : uploadButtonLabel}
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
                    label='Type'
                    fieldType='select'
                    name='type'
                    control={form.control}
                    options={ENTRYPOINT_TYPE_OPTIONS}
                />
                {isPythonScript && (
                    <FormFieldRHF<EntrypointEditorFormValues>
                        variant='inline'
                        label='Entry Script'
                        fieldType='input'
                        name='entrypointScript'
                        control={form.control}
                        placeholder='main.py'
                    />
                )}
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

            {watchedEntrypointType === EntrypointType.PYTHON_SCRIPT && (
                <CollapsibleSection title='Requirements File' defaultExpanded>
                    <Container className='d-flex column gap-05'>
                        <Paragraph className='entrypoint-requirements-hint font-size-1 color-secondary'>
                            Define the Python dependencies to install into the cached virtual environment.
                        </Paragraph>
                        <Container className='entrypoint-requirements-editor'>
                            <Editor
                                height='180px'
                                language='plaintext'
                                value={watchedRequirementsFile}
                                theme={monacoTheme}
                                loading={<Container className='p-1 color-secondary'>Loading editor...</Container>}
                                options={monacoOptions}
                                onChange={(value) => {
                                    form.setValue('requirementsFile', value ?? '', { shouldDirty: true });
                                }}
                            />
                        </Container>
                    </Container>
                </CollapsibleSection>
            )}

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

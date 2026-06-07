import { Box, Button, Row, Stack, Text } from '@voltstack/bravais';
import FormSection from '@/shared/presentation/components/FormSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import { EntrypointType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { applyMonacoTheme, getMonacoThemeName } from '@/shared/presentation/utilities/ensure-monaco';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/app-theme';
import Editor from '@monaco-editor/react';
import { useEffect, useMemo, useState } from 'react';
import { Upload, File, Trash2, Check } from 'lucide-react';
import { ENTRYPOINT_EDITOR_DEFAULT_VALUES, entrypointEditorSchema } from './schema';
import type { EntrypointEditorFormValues } from './schema';
import useEntrypointBinaryActions from './use-entrypoint-binary-actions';
import type { EditorProps } from '../types';
import './EntrypointEditor.css';

const ENTRYPOINT_TYPE_OPTIONS = [{
    value: EntrypointType.EXECUTABLE,
    title: 'Executable'
}, {
    value: EntrypointType.PYTHON_SCRIPT,
    title: 'Python Script'
}, {
    value: EntrypointType.PACKAGED_EXECUTABLE,
    title: 'Packaged Executable'
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
    const isPythonScript = watchedEntrypointType === EntrypointType.PYTHON_SCRIPT;
    const isPackagedExecutable = watchedEntrypointType === EntrypointType.PACKAGED_EXECUTABLE;
    const binarySectionTitle = isPythonScript
        ? 'Project'
        : isPackagedExecutable
            ? 'Package'
            : 'Binary';
    const uploadButtonLabel = isPythonScript
        ? 'Upload Project (ZIP)'
        : isPackagedExecutable
            ? 'Upload Package (ZIP)'
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
            <FormSection title={binarySectionTitle}>
                <Stack gap='05' className='binary-upload-container'>
                    <input
                        ref={fileInputRef}
                        type='file'
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />

                    {watchedBinaryObjectPath ? (
                        <Row justify='between' className='binary-uploaded'>
                            <Row gap='05' className='binary-file-info'>
                                <File size={20} />
                                <Text as='span' size='md' weight='medium' className='binary-filename overflow-hidden'>
                                    {watchedBinaryFileName || watchedBinary}
                                </Text>
                                <Check size={16} className='binary-check-icon' />
                            </Row>
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                onClick={handleRemoveBinary}
                            >
                                <Trash2 size={16} />
                            </Button>
                        </Row>
                    ) : (
                        <Button
                            variant='outline'
                            intent='neutral'
                            size='sm'
                            leftIcon={<Upload size={18} />}
                            onClick={triggerFileSelect}
                            disabled={isUploading || !currentPluginId}
                        >
                            {isUploading ? `Uploading... ${uploadProgress}%` : uploadButtonLabel}
                        </Button>
                    )}

                    {!currentPluginId && (
                        <Text as='p' size='sm' className='binary-upload-hint'>
                            Save the plugin first (Ctrl+S) to enable binary upload
                        </Text>
                    )}

                    {uploadError && (
                        <Text as='p' size='sm' className='binary-upload-error'>{uploadError}</Text>
                    )}

                    {isUploading && (
                        <Box width='max' className='binary-upload-progress overflow-hidden'>
                            <Box
                                height='max'
                                className='binary-upload-progress-bar'
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </Box>
                    )}
                </Stack>
            </FormSection>

            <FormSection title='Execution'>
                <FormFieldRHF<EntrypointEditorFormValues>
                    variant='inline'
                    label='Type'
                    fieldType='select'
                    name='type'
                    control={form.control}
                    options={ENTRYPOINT_TYPE_OPTIONS}
                />
                {(isPythonScript || isPackagedExecutable) && (
                    <FormFieldRHF<EntrypointEditorFormValues>
                        variant='inline'
                        label='Entry Script'
                        fieldType='input'
                        name='entrypointScript'
                        control={form.control}
                        placeholder={isPackagedExecutable ? 'opendxa' : 'main.py'}
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
            </FormSection>

            {watchedEntrypointType === EntrypointType.PYTHON_SCRIPT && (
                <FormSection title='Requirements File'>
                    <Stack gap='05'>
                        <Text as='p' size='sm' tone='secondary' className='entrypoint-requirements-hint'>
                            Define the Python dependencies to install into the cached virtual environment.
                        </Text>
                        <div className='entrypoint-requirements-editor'>
                            <Editor
                                height='180px'
                                language='plaintext'
                                value={watchedRequirementsFile}
                                theme={monacoTheme}
                                loading={<Box p='1' className='color-secondary'>Loading editor...</Box>}
                                options={monacoOptions}
                                onChange={(value) => {
                                    form.setValue('requirementsFile', value ?? '', { shouldDirty: true });
                                }}
                            />
                        </div>
                    </Stack>
                </FormSection>
            )}

        </>
    );
};

export default EntrypointEditor;

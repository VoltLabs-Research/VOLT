import { Button } from '@heroui/react';
import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useNodeEditorForm from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import { EntrypointType } from '@volt/contracts/modules/plugin/enums';
import { applyMonacoTheme, getMonacoThemeName } from '@/shared/ui/utils/ensure-monaco';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/ui/utils/app-theme';
import Editor from '@monaco-editor/react';
import { useEffect, useState } from 'react';
import { Upload, File, Trash2, Check } from 'lucide-react';
import { ENTRYPOINT_EDITOR_DEFAULT_VALUES } from './schema';
import type { EntrypointEditorFormValues } from './schema';
import useEntrypointBinaryActions from './use-entrypoint-binary-actions';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';

/**
 * `EntrypointEditor.css`, as utilities.
 *
 * `--status-success-bg` / `--status-success-border` are `--success-soft` and
 * `color-mix(… success 24% …)`; `--accent-green` is `--success`; `--radius-sm` is 8px,
 * which is `rounded-lg` (spec §3b). `--accent-indigo` stays a literal token — it is a
 * per-theme colour the global sheet declares, and the progress bar's gradient is the
 * one place in this module that names it.
 *
 * One repair rather than a translation: the requirements editor's border read
 * `var(--color-border-subtle)`, a token nothing has ever declared. An undefined
 * `var()` inside the `border:` shorthand invalidates the whole declaration, so that
 * frame has been rendering with no border at all — it becomes `border border-border`,
 * which is what every other framed block here uses.
 */
const BINARY_UPLOADED_CLASS = 'flex flex-row items-center justify-between rounded-lg border border-success/24 bg-success-soft px-3 py-2.5';
const BINARY_FILE_INFO_CLASS = 'flex flex-row items-center gap-2 text-success';
const BINARY_FILENAME_CLASS = 'max-w-[180px] overflow-hidden whitespace-nowrap text-ellipsis text-sm font-medium';
const BINARY_PROGRESS_CLASS = 'h-1 w-full overflow-hidden rounded-[2px] bg-[color-mix(in_srgb,var(--accent-indigo)_10%,transparent)]';
const BINARY_PROGRESS_BAR_CLASS = 'h-full rounded-[2px] bg-[linear-gradient(90deg,var(--accent-indigo),color-mix(in_srgb,var(--accent-indigo)_70%,white))] transition-[width] duration-200 ease-out';
const REQUIREMENTS_EDITOR_CLASS = 'overflow-hidden rounded-lg border border-border';

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

const MONACO_OPTIONS = {
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
};

const EntrypointEditor = ({ node }: EditorProps) => {
    const form = useNodeEditorForm<EntrypointEditorFormValues>(node, 'entrypoint', ENTRYPOINT_EDITOR_DEFAULT_VALUES);
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
    }, [form]);

    useEffect(() => {
        applyMonacoTheme();

        return subscribeToAppTheme((theme) => {
            setMonacoTheme(getMonacoThemeName(theme));
            applyMonacoTheme(theme);
        });
    }, []);

    return (
        <>
            <FormSection title={binarySectionTitle}>
                <div className='mt-2 flex flex-col gap-2'>
                    <input
                        ref={fileInputRef}
                        type='file'
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />

                    {watchedBinaryObjectPath ? (
                        <div className={BINARY_UPLOADED_CLASS}>
                            <div className={BINARY_FILE_INFO_CLASS}>
                                <File size={20} aria-hidden='true' />
                                <span className={BINARY_FILENAME_CLASS}>
                                    {watchedBinaryFileName || watchedBinary}
                                </span>
                                <Check size={16} className='text-success' aria-hidden='true' />
                            </div>
                            {/* bravais `ghost` + `danger` is `ghost` plus `text-danger` (spec §4d). */}
                            <Button
                                variant='ghost'
                                size='sm'
                                className='text-danger'
                                aria-label={`Remove ${binarySectionTitle.toLowerCase()}`}
                                onPress={handleRemoveBinary}
                            >
                                <Trash2 size={16} aria-hidden='true' />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant='outline'
                            size='sm'
                            onPress={triggerFileSelect}
                            isDisabled={isUploading || !currentPluginId}
                        >
                            <Upload size={18} aria-hidden='true' />
                            {isUploading ? `Uploading... ${uploadProgress}%` : uploadButtonLabel}
                        </Button>
                    )}

                    {!currentPluginId && (
                        <p className='m-0 text-xs italic text-muted'>
                            Save the plugin first (Ctrl+S) to enable binary upload
                        </p>
                    )}

                    {uploadError && (
                        <p className='m-0 text-xs text-danger'>{uploadError}</p>
                    )}

                    {isUploading && (
                        <div className={BINARY_PROGRESS_CLASS}>
                            <div
                                className={BINARY_PROGRESS_BAR_CLASS}
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    )}
                </div>
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
                    <div className='flex flex-col gap-2'>
                        <p className='m-0 text-xs text-muted'>
                            Define the Python dependencies to install into the cached virtual environment.
                        </p>
                        <div className={REQUIREMENTS_EDITOR_CLASS}>
                            <Editor
                                height='180px'
                                language='plaintext'
                                value={watchedRequirementsFile}
                                theme={monacoTheme}
                                loading={<div className='p-4 text-muted'>Loading editor...</div>}
                                options={MONACO_OPTIONS}
                                onChange={(value) => {
                                    form.setValue('requirementsFile', value ?? '', { shouldDirty: true });
                                }}
                            />
                        </div>
                    </div>
                </FormSection>
            )}

        </>
    );
};

export default EntrypointEditor;

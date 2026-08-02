import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useNodeEditorForm from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import { CONTEXT_OPTIONS } from '@/modules/plugin/utils/plugin/node-registry';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';
import { CONTEXT_EDITOR_DEFAULT_VALUES } from './schema';
import type { ContextEditorFormValues } from './schema';

const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const ContextEditor = ({ node }: EditorProps) => {
    const form = useNodeEditorForm<ContextEditorFormValues>(node, 'context', CONTEXT_EDITOR_DEFAULT_VALUES);

    return (
        <FormSection title='Data Source'>
            <FormFieldRHF<ContextEditorFormValues>
                variant='inline'
                label='Source'
                fieldType='select'
                name='source'
                control={form.control}
                options={CONTEXT_SELECT_OPTIONS}
            />
        </FormSection>
    );
};

export default ContextEditor;

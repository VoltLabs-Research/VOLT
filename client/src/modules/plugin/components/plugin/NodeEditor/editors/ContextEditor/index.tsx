import FormSection from '@/shared/presentation/components/FormSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import { CONTEXT_OPTIONS } from '@/modules/plugin/utilities/plugin/node-registry';
import type { EditorProps } from '../types';
import { CONTEXT_EDITOR_DEFAULT_VALUES } from './schema';
import type { ContextEditorFormValues } from './schema';

const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const useContextEditorForm = createNodeEditorForm<ContextEditorFormValues, 'context'>({
    defaults: CONTEXT_EDITOR_DEFAULT_VALUES,
    dataKey: 'context'
});

const ContextEditor = ({ node }: EditorProps) => {
    const form = useContextEditorForm(node);

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

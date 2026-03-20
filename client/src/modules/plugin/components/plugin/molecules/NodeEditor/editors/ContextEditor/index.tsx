import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/molecules/NodeEditor/hooks/use-node-editor-form';
import { CONTEXT_OPTIONS } from '@/modules/plugin/utilities/plugin/node-registry';
import type { EditorProps } from '../types';
import { contextEditorSchema, CONTEXT_EDITOR_DEFAULT_VALUES, type ContextEditorFormValues } from './schema';

const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const useContextEditorForm = createNodeEditorForm<ContextEditorFormValues, 'context'>({
    schema: contextEditorSchema,
    defaults: CONTEXT_EDITOR_DEFAULT_VALUES,
    dataKey: 'context'
});

const ContextEditor = ({ node }: EditorProps) => {
    const form = useContextEditorForm(node);

    return (
        <CollapsibleSection title='Data Source' defaultExpanded>
            <FormFieldRHF<ContextEditorFormValues>
                variant='inline'
                label='Source'
                fieldType='select'
                name='source'
                control={form.control}
                options={CONTEXT_SELECT_OPTIONS}
            />
        </CollapsibleSection>
    );
};

export default ContextEditor;

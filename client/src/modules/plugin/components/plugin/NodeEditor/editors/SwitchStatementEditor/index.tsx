import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';

interface SwitchStatementEditorFormValues {
    expression: string;
}

const useSwitchStatementEditorForm = createNodeEditorForm<SwitchStatementEditorFormValues, 'switchStatement'>({
    defaults: {
        expression: ''
    },
    dataKey: 'switchStatement'
});

const SwitchStatementEditor = ({ node }: EditorProps) => {
    const form = useSwitchStatementEditorForm(node);
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);

    return (
        <FormSection title='Evaluation'>
            <FormFieldRHF<SwitchStatementEditorFormValues>
                variant='inline'
                label='Expression'
                fieldType='input'
                name='expression'
                control={form.control}
                placeholder='{{ some-node-id.some-value }}'
                autocomplete={{ options: nodeReferenceOptions }}
            />
        </FormSection>
    );
};

export default SwitchStatementEditor;

import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import useNodeEditorForm from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';

interface SwitchStatementEditorFormValues {
    expression: string;
}

const SWITCH_STATEMENT_DEFAULT_VALUES: SwitchStatementEditorFormValues = { expression: '' };

const SwitchStatementEditor = ({ node }: EditorProps) => {
    const form = useNodeEditorForm<SwitchStatementEditorFormValues>(node, 'switchStatement', SWITCH_STATEMENT_DEFAULT_VALUES);
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

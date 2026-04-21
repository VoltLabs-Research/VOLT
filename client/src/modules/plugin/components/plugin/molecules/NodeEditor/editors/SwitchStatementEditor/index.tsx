import { z } from 'zod/v4';
import FormSection from '@/shared/presentation/components/FormSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/molecules/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '../types';

const switchStatementEditorSchema = z.object({
    expression: z.string().default('')
}).strict();

type SwitchStatementEditorFormValues = z.infer<typeof switchStatementEditorSchema>;

const useSwitchStatementEditorForm = createNodeEditorForm<SwitchStatementEditorFormValues, 'switchStatement'>({
    schema: switchStatementEditorSchema,
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

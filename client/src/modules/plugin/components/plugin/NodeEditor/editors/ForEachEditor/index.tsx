import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';
import { FOR_EACH_EDITOR_DEFAULT_VALUES } from './schema';
import type { ForEachEditorFormValues } from './schema';

const useForEachEditorForm = createNodeEditorForm<ForEachEditorFormValues, 'forEach'>({
    defaults: FOR_EACH_EDITOR_DEFAULT_VALUES,
    dataKey: 'forEach'
});

const ForEachEditor = ({ node }: EditorProps) => {
    const form = useForEachEditorForm(node);
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);

    return (
        <FormSection title='Iteration'>
            <FormFieldRHF<ForEachEditorFormValues>
                variant='inline'
                label='Iterable Source'
                fieldType='input'
                name='iterableSource'
                control={form.control}
                placeholder='{{ Context.trajectory_dumps }}'
                autocomplete={{ options: nodeReferenceOptions }}
            />
        </FormSection>
    );
};

export default ForEachEditor;

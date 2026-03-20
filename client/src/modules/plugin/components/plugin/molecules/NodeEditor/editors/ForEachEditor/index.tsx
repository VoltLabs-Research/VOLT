import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/molecules/NodeEditor/hooks/use-node-editor-form';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import type { EditorProps } from '../types';
import { FOR_EACH_EDITOR_DEFAULT_VALUES, forEachEditorSchema, type ForEachEditorFormValues } from './schema';

const useForEachEditorForm = createNodeEditorForm<ForEachEditorFormValues, 'forEach'>({
    schema: forEachEditorSchema,
    defaults: FOR_EACH_EDITOR_DEFAULT_VALUES,
    dataKey: 'forEach'
});

const ForEachEditor = ({ node }: EditorProps) => {
    const form = useForEachEditorForm(node);
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);

    return (
        <CollapsibleSection title='Iteration' defaultExpanded>
            <FormFieldRHF<ForEachEditorFormValues>
                variant='inline'
                label='Iterable Source'
                fieldType='input'
                name='iterableSource'
                control={form.control}
                placeholder='{{ Context.trajectory_dumps }}'
                autocomplete={{ options: nodeReferenceOptions }}
            />
        </CollapsibleSection>
    );
};

export default ForEachEditor;

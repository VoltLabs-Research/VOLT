import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import useNodeFormRHF from '@/modules/plugin/hooks/use-node-form-rhf';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/use-node-reference-autocomplete';
import { z } from 'zod/v4';
import type { EditorProps } from '../types';

const forEachEditorSchema = z.object({
    iterableSource: z.string().default('')
}).strict();

type ForEachEditorFormValues = z.infer<typeof forEachEditorSchema>;

const DEFAULT_VALUES: ForEachEditorFormValues = {
    iterableSource: ''
};

const ForEachEditor = ({ node }: EditorProps) => {
    const form = useNodeFormRHF<ForEachEditorFormValues>({
        schema: forEachEditorSchema,
        nodeId: node.id,
        dataKey: 'forEach',
        node,
        defaultValue: DEFAULT_VALUES
    });
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

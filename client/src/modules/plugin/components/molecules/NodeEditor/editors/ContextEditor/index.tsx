import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import useNodeFormRHF from '@/modules/plugin/hooks/use-node-form-rhf';
import { CONTEXT_OPTIONS } from '@/modules/plugin/utilities/node-types';
import { ModifierContext } from '@/modules/plugin/api/entities/workflow-enums';
import { z } from 'zod/v4';
import type { EditorProps } from '../types';

const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const contextEditorSchema = z.object({
    source: z.string().default(ModifierContext.TRAJECTORY_DUMPS)
}).strict();

type ContextEditorFormValues = z.infer<typeof contextEditorSchema>;

const DEFAULT_VALUES: ContextEditorFormValues = {
    source: ModifierContext.TRAJECTORY_DUMPS
};

const ContextEditor = ({ node }: EditorProps) => {
    const form = useNodeFormRHF<ContextEditorFormValues>({
        schema: contextEditorSchema,
        nodeId: node.id,
        dataKey: 'context',
        node,
        defaultValue: DEFAULT_VALUES
    });

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

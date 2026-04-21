import { z } from 'zod/v4';
import FormSection from '@/shared/presentation/components/FormSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/molecules/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '../types';

const switchCaseEditorSchema = z.object({
    value: z.string().default(''),
    defaultCase: z.boolean().default(false)
}).strict();

type SwitchCaseEditorFormValues = z.infer<typeof switchCaseEditorSchema>;

const useSwitchCaseEditorForm = createNodeEditorForm<SwitchCaseEditorFormValues, 'switchCase'>({
    schema: switchCaseEditorSchema,
    defaults: {
        value: '',
        defaultCase: false
    },
    dataKey: 'switchCase'
});

const SwitchCaseEditor = ({ node }: EditorProps) => {
    const form = useSwitchCaseEditorForm(node);
    const isDefaultCase = form.watch('defaultCase') ?? false;

    return (
        <FormSection title='Case'>
            <FormFieldRHF<SwitchCaseEditorFormValues>
                variant='inline'
                label='Value'
                fieldType='input'
                name='value'
                control={form.control}
                placeholder='expected-value'
                disabled={isDefaultCase}
            />
            <FormFieldRHF<SwitchCaseEditorFormValues>
                variant='inline'
                label='Default case'
                fieldType='checkbox'
                name='defaultCase'
                control={form.control}
            />
        </FormSection>
    );
};

export default SwitchCaseEditor;

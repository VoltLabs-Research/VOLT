import FormSection from '@/shared/presentation/components/FormSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '../types';

interface SwitchCaseEditorFormValues {
    value: string;
    defaultCase: boolean;
}

const useSwitchCaseEditorForm = createNodeEditorForm<SwitchCaseEditorFormValues, 'switchCase'>({
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

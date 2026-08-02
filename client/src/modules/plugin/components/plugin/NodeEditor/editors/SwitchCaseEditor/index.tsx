import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useNodeEditorForm from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';

interface SwitchCaseEditorFormValues {
    value: string;
    defaultCase: boolean;
}

const SWITCH_CASE_DEFAULT_VALUES: SwitchCaseEditorFormValues = {
    value: '',
    defaultCase: false
};

const SwitchCaseEditor = ({ node }: EditorProps) => {
    const form = useNodeEditorForm<SwitchCaseEditorFormValues>(node, 'switchCase', SWITCH_CASE_DEFAULT_VALUES);
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

import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useNodeEditorForm from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';
import { MODIFIER_EDITOR_DEFAULT_VALUES } from './schema';
import type { ModifierEditorFormValues } from './schema';

const ModifierEditor = ({ node }: EditorProps) => {
    const form = useNodeEditorForm<ModifierEditorFormValues>(node, 'modifier', MODIFIER_EDITOR_DEFAULT_VALUES);

    return (
        <>
            <FormSection title='Plugin Info'>
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='Name'
                    fieldType='input'
                    name='name'
                    control={form.control}
                    placeholder='My Plugin'
                />
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='Key'
                    fieldType='input'
                    name='key'
                    control={form.control}
                    placeholder='my-plugin'
                />
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='Version'
                    fieldType='input'
                    name='version'
                    control={form.control}
                    placeholder='1.0.0'
                />
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='Description'
                    fieldType='input'
                    name='description'
                    control={form.control}
                    placeholder='Plugin description…'
                />
            </FormSection>

            <FormSection title='Author'>
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='Name'
                    fieldType='input'
                    name='author'
                    control={form.control}
                    placeholder='Your name'
                />
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='License'
                    fieldType='input'
                    name='license'
                    control={form.control}
                    placeholder='MIT'
                />
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='Homepage'
                    fieldType='input'
                    name='homepage'
                    control={form.control}
                    placeholder='https://…'
                />
            </FormSection>
        </>
    );
};

export default ModifierEditor;

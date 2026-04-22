import FormSection from '@/shared/presentation/components/FormSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '../types';
import { MODIFIER_EDITOR_DEFAULT_VALUES, modifierEditorSchema } from './schema';
import type { ModifierEditorFormValues } from './schema';

const useModifierEditorForm = createNodeEditorForm<ModifierEditorFormValues, 'modifier'>({
    schema: modifierEditorSchema,
    defaults: MODIFIER_EDITOR_DEFAULT_VALUES,
    dataKey: 'modifier'
});

const ModifierEditor = ({ node }: EditorProps) => {
    const form = useModifierEditorForm(node);

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

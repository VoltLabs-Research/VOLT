import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/molecules/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '../types';
import { MODIFIER_EDITOR_DEFAULT_VALUES, modifierEditorSchema, type ModifierEditorFormValues } from './schema';

const useModifierEditorForm = createNodeEditorForm<ModifierEditorFormValues, 'modifier'>({
    schema: modifierEditorSchema,
    defaults: MODIFIER_EDITOR_DEFAULT_VALUES,
    dataKey: 'modifier'
});

const ModifierEditor = ({ node }: EditorProps) => {
    const form = useModifierEditorForm(node);

    return (
        <>
            <CollapsibleSection title='Plugin Info' defaultExpanded>
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
                    placeholder='Plugin description...'
                />
            </CollapsibleSection>

            <CollapsibleSection title='Author Details'>
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='Author'
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
                    placeholder='https://...'
                />
            </CollapsibleSection>

            <CollapsibleSection title='Appearance'>
                <FormFieldRHF<ModifierEditorFormValues>
                    variant='inline'
                    label='Icon'
                    fieldType='input'
                    name='icon'
                    control={form.control}
                    placeholder='TbPlugConnected'
                />
            </CollapsibleSection>
        </>
    );
};

export default ModifierEditor;

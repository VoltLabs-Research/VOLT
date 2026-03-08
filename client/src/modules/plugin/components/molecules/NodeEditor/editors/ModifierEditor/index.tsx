import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import useNodeFormRHF from '@/modules/plugin/hooks/use-node-form-rhf';
import { z } from 'zod/v4';
import type { EditorProps } from '../types';

const modifierEditorSchema = z.object({
    name: z.string().default(''),
    icon: z.string().default(''),
    author: z.string().default(''),
    license: z.string().default(''),
    version: z.string().default(''),
    homepage: z.string().default(''),
    description: z.string().default('')
}).strict();

type ModifierEditorFormValues = z.infer<typeof modifierEditorSchema>;

const DEFAULT_VALUES: ModifierEditorFormValues = {
    name: '',
    icon: '',
    author: '',
    license: '',
    version: '',
    homepage: '',
    description: ''
};

const ModifierEditor = ({ node }: EditorProps) => {
    const form = useNodeFormRHF<ModifierEditorFormValues>({
        schema: modifierEditorSchema,
        nodeId: node.id,
        dataKey: 'modifier',
        node,
        defaultValue: DEFAULT_VALUES
    });

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

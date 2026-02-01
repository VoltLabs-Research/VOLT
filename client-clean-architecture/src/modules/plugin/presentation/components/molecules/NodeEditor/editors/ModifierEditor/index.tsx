import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import type { IModifierData } from '@/modules/plugin/domain/entities';

interface ModifierEditorProps {
    node: Node;
};

const DEFAULT_MODIFIER: Partial<IModifierData> = {};

const ModifierEditor = ({ node }: ModifierEditorProps) => {
    const { field } = useNodeForm(node, 'modifier', DEFAULT_MODIFIER);

    return (
        <>
            <CollapsibleSection title='Plugin Info' defaultExpanded>
                <FormField
                    variant='inline'
                    label='Name'
                    fieldType='input'
                    {...field('name')}
                    placeholder='My Plugin'
                />
                <FormField
                    variant='inline'
                    label='Version'
                    fieldType='input'
                    {...field('version')}
                    placeholder='1.0.0'
                />
                <FormField
                    variant='inline'
                    label='Description'
                    fieldType='input'
                    {...field('description')}
                    placeholder='Plugin description...'
                />
            </CollapsibleSection>

            <CollapsibleSection title='Author Details'>
                <FormField
                    variant='inline'
                    label='Author'
                    fieldType='input'
                    {...field('author')}
                    placeholder='Your name'
                />
                <FormField
                    variant='inline'
                    label='License'
                    fieldType='input'
                    {...field('license')}
                    placeholder='MIT'
                />
                <FormField
                    variant='inline'
                    label='Homepage'
                    fieldType='input'
                    {...field('homepage')}
                    placeholder='https://...'
                />
            </CollapsibleSection>

            <CollapsibleSection title='Appearance'>
                <FormField
                    variant='inline'
                    label='Icon'
                    fieldType='input'
                    {...field('icon')}
                    placeholder='TbPlugConnected'
                />
            </CollapsibleSection>
        </>
    );
};

export default ModifierEditor;

import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import { useNodeData } from '@/hooks/plugins/use-node-data';
import type { IModifierData } from '@/types/plugin';

interface ModifierEditorProps {
    node: Node;
}

const DEFAULT_MODIFIER: Partial<IModifierData> = {};

const ModifierEditor: React.FC<ModifierEditorProps> = ({ node }) => {
    const { data: modifier, updateField } = useNodeData(node, 'modifier', DEFAULT_MODIFIER);

    return (
        <>
            <CollapsibleSection title='Plugin Info' defaultExpanded>
                <FormField
                    label='Name'
                    fieldKey='name'
                    fieldType='input'
                    fieldValue={modifier.name || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: 'My Plugin' }}
                />
                <FormField
                    label='Version'
                    fieldKey='version'
                    fieldType='input'
                    fieldValue={modifier.version || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: '1.0.0' }}
                />
                <FormField
                    label='Description'
                    fieldKey='description'
                    fieldType='input'
                    fieldValue={modifier.description || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: 'Plugin description...' }}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Author Details'>
                <FormField
                    label='Author'
                    fieldKey='author'
                    fieldType='input'
                    fieldValue={modifier.author || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: 'Your name' }}
                />
                <FormField
                    label='License'
                    fieldKey='license'
                    fieldType='input'
                    fieldValue={modifier.license || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: 'MIT' }}
                />
                <FormField
                    label='Homepage'
                    fieldKey='homepage'
                    fieldType='input'
                    fieldValue={modifier.homepage || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: 'https://...' }}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Appearance'>
                <FormField
                    label='Icon'
                    fieldKey='icon'
                    fieldType='iconSelect'
                    fieldValue={modifier.icon || ''}
                    onFieldChange={updateField}
                    renderInPortal
                />
            </CollapsibleSection>
        </>
    );
};

export default ModifierEditor;

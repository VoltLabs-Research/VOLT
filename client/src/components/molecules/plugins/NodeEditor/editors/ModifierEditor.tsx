import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import usePluginBuilderStore from '@/stores/plugin-builder';
import type { IModifierData } from '@/types/plugin';

interface ModifierEditorProps {
    node: Node;
}

const ModifierEditor: React.FC<ModifierEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const modifier = (node.data?.modifier || {}) as Partial<IModifierData>;

    const handleFieldChange = (key: string, value: any) => {
        updateNodeData(node.id, {
            modifier: { ...modifier, [key]: value }
        });
    };

    return (
        <>
            <CollapsibleSection title='Plugin Info' defaultExpanded>
                <FormField
                    label='Name'
                    fieldKey='name'
                    fieldType='input'
                    fieldValue={modifier.name || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: 'My Plugin' }}
                />
                <FormField
                    label='Version'
                    fieldKey='version'
                    fieldType='input'
                    fieldValue={modifier.version || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: '1.0.0' }}
                />
                <FormField
                    label='Description'
                    fieldKey='description'
                    fieldType='input'
                    fieldValue={modifier.description || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: 'Plugin description...' }}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Author Details'>
                <FormField
                    label='Author'
                    fieldKey='author'
                    fieldType='input'
                    fieldValue={modifier.author || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: 'Your name' }}
                />
                <FormField
                    label='License'
                    fieldKey='license'
                    fieldType='input'
                    fieldValue={modifier.license || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: 'MIT' }}
                />
                <FormField
                    label='Homepage'
                    fieldKey='homepage'
                    fieldType='input'
                    fieldValue={modifier.homepage || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: 'https://...' }}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Appearance'>
                <FormField
                    label='Icon'
                    fieldKey='icon'
                    fieldType='input'
                    fieldValue={modifier.icon || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: 'Icon name or URL' }}
                />
            </CollapsibleSection>
        </>
    );
};

export default ModifierEditor;

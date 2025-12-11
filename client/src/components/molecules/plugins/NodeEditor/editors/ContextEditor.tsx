import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import usePluginBuilderStore from '@/stores/plugin-builder';
import { CONTEXT_OPTIONS } from '@/utilities/plugins/node-types';
import type { IContextData, ModifierContext } from '@/types/plugin';

interface ContextEditorProps {
    node: Node;
}

// Convert to SelectOption format (value, title)
const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const ContextEditor: React.FC<ContextEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const context = (node.data?.context || { source: 'trajectory_dumps' as ModifierContext }) as IContextData;

    const handleFieldChange = (key: string, value: any) => {
        updateNodeData(node.id, {
            context: { ...context, [key]: value }
        });
    };

    return (
        <CollapsibleSection title='Data Source' defaultExpanded>
            <FormField
                label='Source'
                fieldKey='source'
                fieldType='select'
                fieldValue={context.source || ''}
                onFieldChange={handleFieldChange}
                options={CONTEXT_SELECT_OPTIONS}
            />
        </CollapsibleSection>
    );
};

export default ContextEditor;

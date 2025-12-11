import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import usePluginBuilderStore from '@/stores/plugin-builder';
import type { IForEachData } from '@/types/plugin';

interface ForEachEditorProps {
    node: Node;
}

const ForEachEditor: React.FC<ForEachEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const forEach: IForEachData = node.data?.forEach || { iterableSource: '' };

    const handleFieldChange = (key: string, value: any) => {
        updateNodeData(node.id, {
            forEach: { ...forEach, [key]: value }
        });
    };

    return (
        <CollapsibleSection title='Iteration' defaultExpanded>
            <FormField
                label='Iterable Source'
                fieldKey='iterableSource'
                fieldType='input'
                fieldValue={forEach.iterableSource || ''}
                onFieldChange={handleFieldChange}
                inputProps={{ placeholder: 'context.dumps' }}
            />
        </CollapsibleSection>
    );
};

export default ForEachEditor;

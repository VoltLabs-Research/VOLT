import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/atoms/common/CollapsibleSection';
import FormField from '@/shared/presentation/components/molecules/form/FormField';
import { useNodeData } from '../../../../hooks/use-node-data';

interface ForEachEditorProps {
    node: Node;
}

interface IForEachData {
    iterableSource: string;
}

const DEFAULT_FOREACH: IForEachData = { iterableSource: '' };

const ForEachEditor: React.FC<ForEachEditorProps> = ({ node }) => {
    const { data: forEach, updateField, nodeId } = useNodeData(node, 'forEach', DEFAULT_FOREACH);

    return (
        <CollapsibleSection title='Iteration' defaultExpanded>
            <FormField
                label='Iterable Source'
                fieldKey='iterableSource'
                fieldType='input'
                fieldValue={forEach.iterableSource || ''}
                onFieldChange={updateField}
                inputProps={{ placeholder: '{{ Context.trajectory_dumps }}' }}
                expressionEnabled
                expressionNodeId={nodeId}
            />
        </CollapsibleSection>
    );
};

export default ForEachEditor;

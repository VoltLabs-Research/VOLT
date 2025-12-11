import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import { useNodeData } from '@/hooks/plugins/use-node-data';
import type { IExposureData } from '@/types/plugin';

interface ExposureEditorProps {
    node: Node;
}

const DEFAULT_EXPOSURE: IExposureData = { name: '', results: '' };

const ExposureEditor: React.FC<ExposureEditorProps> = ({ node }) => {
    const { data: exposure, updateField, nodeId } = useNodeData(node, 'exposure', DEFAULT_EXPOSURE);

    return (
        <CollapsibleSection title='Results Exposure' defaultExpanded>
            <FormField
                label='Exposure Name'
                fieldKey='name'
                fieldType='input'
                fieldValue={exposure.name || ''}
                onFieldChange={updateField}
                inputProps={{ placeholder: 'analysis_results' }}
                expressionEnabled
                expressionNodeId={nodeId}
            />
            <FormField
                label='Results File Suffix'
                fieldKey='results'
                fieldType='input'
                fieldValue={exposure.results || ''}
                onFieldChange={updateField}
                inputProps={{ placeholder: 'results.msgpack' }}
                expressionEnabled
                expressionNodeId={nodeId}
            />
            <FormField
                label='Iterable Path'
                fieldKey='iterable'
                fieldType='input'
                fieldValue={exposure.iterable || ''}
                onFieldChange={updateField}
                inputProps={{ placeholder: 'data.atoms' }}
                expressionEnabled
                expressionNodeId={nodeId}
            />
        </CollapsibleSection>
    );
};

export default ExposureEditor;

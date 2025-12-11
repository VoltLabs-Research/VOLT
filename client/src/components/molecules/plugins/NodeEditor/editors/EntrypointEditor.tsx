import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import { useNodeData } from '@/hooks/plugins/use-node-data';
import type { IEntrypointData } from '@/types/plugin';

interface EntrypointEditorProps {
    node: Node;
}

const DEFAULT_ENTRYPOINT: Partial<IEntrypointData> = { binary: '', arguments: '' };

const EntrypointEditor: React.FC<EntrypointEditorProps> = ({ node }) => {
    const { data: entrypoint, updateField, nodeId } = useNodeData(node, 'entrypoint', DEFAULT_ENTRYPOINT);

    return (
        <>
            <CollapsibleSection title='Execution' defaultExpanded>
                <FormField
                    label='Binary'
                    fieldKey='binary'
                    fieldType='input'
                    fieldValue={entrypoint.binary || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: 'analysis.py, processor, ...' }}
                    expressionEnabled
                    expressionNodeId={nodeId}
                />
                <FormField
                    label='Command Arguments'
                    fieldKey='arguments'
                    fieldType='input'
                    fieldValue={entrypoint.arguments || ''}
                    onFieldChange={updateField}
                    inputProps={{ placeholder: '{{ forEach.currentValue }} --output {{ forEach.outputPath }}' }}
                    expressionEnabled
                    expressionNodeId={nodeId}
                    expressionMultiline
                    expressionRows={3}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Options'>
                <FormField
                    label='Timeout (ms)'
                    fieldKey='timeout'
                    fieldType='input'
                    fieldValue={entrypoint.timeout ?? ''}
                    onFieldChange={(key, value) => updateField(key, Number(value) || undefined)}
                    inputProps={{ type: 'number', placeholder: '30000' }}
                />
            </CollapsibleSection>
        </>
    );
};

export default EntrypointEditor;

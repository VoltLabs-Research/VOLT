import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import usePluginBuilderStore from '@/stores/plugin-builder';
import type { IEntrypointData } from '@/types/plugin';

interface EntrypointEditorProps {
    node: Node;
}

const EntrypointEditor: React.FC<EntrypointEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const entrypoint = (node.data?.entrypoint || { binary: '', arguments: '' }) as IEntrypointData;

    const handleFieldChange = (key: string, value: any) => {
        updateNodeData(node.id, {
            entrypoint: { ...entrypoint, [key]: value }
        });
    };

    return (
        <>
            <CollapsibleSection title='Execution' defaultExpanded>
                <FormField
                    label='Binary'
                    fieldKey='binary'
                    fieldType='input'
                    fieldValue={entrypoint.binary || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: 'python, ovito, ...' }}
                />
                <FormField
                    label='Arguments'
                    fieldKey='arguments'
                    fieldType='input'
                    fieldValue={entrypoint.arguments || ''}
                    onFieldChange={handleFieldChange}
                    inputProps={{ placeholder: '--input ${context.file}' }}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Options'>
                <FormField
                    label='Timeout (ms)'
                    fieldKey='timeout'
                    fieldType='input'
                    fieldValue={entrypoint.timeout ?? ''}
                    onFieldChange={(key, value) => handleFieldChange(key, Number(value) || undefined)}
                    inputProps={{ type: 'number', placeholder: '30000' }}
                />
            </CollapsibleSection>
        </>
    );
};

export default EntrypointEditor;

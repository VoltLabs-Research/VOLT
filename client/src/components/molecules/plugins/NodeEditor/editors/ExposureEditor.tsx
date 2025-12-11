import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import usePluginBuilderStore from '@/stores/plugin-builder';
import type { IExposureData } from '@/types/plugin';

interface ExposureEditorProps {
    node: Node;
}

const ExposureEditor: React.FC<ExposureEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const exposure = (node.data?.exposure || { name: '', results: '' }) as IExposureData;

    const handleFieldChange = (key: string, value: any) => {
        updateNodeData(node.id, {
            exposure: { ...exposure, [key]: value }
        });
    };

    return (
        <CollapsibleSection title='Results Exposure' defaultExpanded>
            <FormField
                label='Name'
                fieldKey='name'
                fieldType='input'
                fieldValue={exposure.name || ''}
                onFieldChange={handleFieldChange}
                inputProps={{ placeholder: 'results' }}
            />
            <FormField
                label='Results Path'
                fieldKey='results'
                fieldType='input'
                fieldValue={exposure.results || ''}
                onFieldChange={handleFieldChange}
                inputProps={{ placeholder: 'output.json' }}
            />
            <FormField
                label='Iterable'
                fieldKey='iterable'
                fieldType='input'
                fieldValue={exposure.iterable || ''}
                onFieldChange={handleFieldChange}
                inputProps={{ placeholder: 'Optional iterable key' }}
            />
        </CollapsibleSection>
    );
};

export default ExposureEditor;

import React, { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import { useNodeData } from '@/hooks/plugins/use-node-data';
import type { IExposureData } from '@/types/plugin';

interface ExposureEditorProps {
    node: Node;
}

const DEFAULT_EXPOSURE: IExposureData = { name: '', results: '', perAtomProperties: [] };

const ExposureEditor: React.FC<ExposureEditorProps> = ({ node }) => {
    const { data: exposure, updateField, nodeId } = useNodeData(node, 'exposure', DEFAULT_EXPOSURE);

    // Handle perAtomProperties as comma-separated string
    const perAtomPropertiesStr = (exposure.perAtomProperties || []).join(', ');

    const handlePerAtomPropertiesChange = useCallback((key: string, value: string) => {
        const props = value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        updateField('perAtomProperties', props);
    }, [updateField]);

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
                label='Icon'
                fieldKey='icon'
                fieldType='iconSelect'
                fieldValue={exposure.icon || ''}
                onFieldChange={updateField}
                renderInPortal
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
            <FormField
                label='Per-Atom Properties'
                fieldKey='perAtomProperties'
                fieldType='input'
                fieldValue={perAtomPropertiesStr}
                onFieldChange={handlePerAtomPropertiesChange}
                inputProps={{ placeholder: 'shear_strain, volumetric_strain' }}
            />
        </CollapsibleSection>
    );
};

export default ExposureEditor;

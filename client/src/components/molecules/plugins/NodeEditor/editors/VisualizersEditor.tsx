import React, { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import KeyValueEditor from '@/components/molecules/plugins/KeyValueEditor';
import usePluginBuilderStore from '@/stores/plugins/plugin-builder';
import { useKeyValueHandlers } from '@/hooks/plugins/use-node-data';
import type { IVisualizersData } from '@/types/plugin';

interface VisualizersEditorProps {
    node: Node;
}

const VisualizersEditor: React.FC<VisualizersEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const visualizersData = (node.data?.visualizers || { canvas: false, raster: false, listing: {} }) as IVisualizersData;

    const { canvas = false, raster = false, listing = {} } = visualizersData;

    const updateVisualizer = useCallback((field: string, value: any) => {
        updateNodeData(node.id, { visualizers: { ...visualizersData, [field]: value } });
    }, [node.id, visualizersData, updateNodeData]);

    const updateListing = useCallback((newListing: Record<string, string>) => {
        updateVisualizer('listing', newListing);
    }, [updateVisualizer]);

    const { entries, handleAdd, handleRemove, handleKeyChange, handleValueChange } =
        useKeyValueHandlers(updateListing, listing, 'column', 'Column Title');

    return(
        <>
            <CollapsibleSection title='Visualization Options' defaultExpanded>
                <FormField
                    label='Enable Canvas(3D Viewer)'
                    fieldKey='canvas'
                    fieldType='checkbox'
                    fieldValue={canvas}
                    onFieldChange={(_, value) => updateVisualizer('canvas', value)}
                />
                <FormField
                    label='Enable Raster(2D Images)'
                    fieldKey='raster'
                    fieldType='checkbox'
                    fieldValue={raster}
                    onFieldChange={(_, value) => updateVisualizer('raster', value)}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Listing Columns' defaultExpanded>
                <KeyValueEditor
                    entries={entries}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    onKeyChange={handleKeyChange}
                    onValueChange={handleValueChange}
                    keyLabel="Field Key / Expression"
                    valueLabel="Column Label"
                    keyPlaceholder="{{ Schema.definition.field }}"
                    valuePlaceholder="Display Name"
                    addButtonText="Add Column"
                    description="Map data fields to table columns. Use {{ }} expressions to reference upstream node data. Type {{ in the Field Key to see available data."
                    expressionEnabled
                    expressionNodeId={node.id}
                />
            </CollapsibleSection>
        </>
    );
};

export default VisualizersEditor;

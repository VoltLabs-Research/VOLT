import React, { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import KeyValueEditor from '@/components/molecules/plugins/KeyValueEditor';
import usePluginBuilderStore from '@/stores/plugin-builder';
import { useKeyValueHandlers } from '@/hooks/plugins/use-node-data';
import { EXPORTER_OPTIONS, EXPORT_TYPE_OPTIONS } from '@/utilities/plugins/node-types';
import type { IExportData, Exporter, ExportType } from '@/types/plugin';

interface ExportEditorProps {
    node: Node;
}

// Convert to SelectOption format (value, title)
const EXPORTER_SELECT_OPTIONS = EXPORTER_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const EXPORT_TYPE_SELECT_OPTIONS = EXPORT_TYPE_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const ExportEditor: React.FC<ExportEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const exportData = (node.data?.export || { exporter: 'AtomisticExporter', type: 'glb', options: {} }) as IExportData;
    
    const { exporter, type, options = {} } = exportData;

    const updateExport = useCallback((field: string, value: any) => {
        updateNodeData(node.id, { export: { ...exportData, [field]: value } });
    }, [node.id, exportData, updateNodeData]);

    const updateOptions = useCallback((newOptions: Record<string, string>) => {
        updateExport('options', newOptions);
    }, [updateExport]);

    const { entries, handleAdd, handleRemove, handleKeyChange, handleValueChange } = 
        useKeyValueHandlers(updateOptions, options as Record<string, string>, 'option');

    return (
        <>
            <CollapsibleSection title='Export Configuration' defaultExpanded>
                <FormField
                    label='Exporter'
                    fieldKey='exporter'
                    fieldType='select'
                    fieldValue={exporter}
                    onFieldChange={(_, value) => updateExport('exporter', value as Exporter)}
                    options={EXPORTER_SELECT_OPTIONS}
                />
                <FormField
                    label='Export Type'
                    fieldKey='type'
                    fieldType='select'
                    fieldValue={type}
                    onFieldChange={(_, value) => updateExport('type', value as ExportType)}
                    options={EXPORT_TYPE_SELECT_OPTIONS}
                />
            </CollapsibleSection>

            <CollapsibleSection title='Export Options' defaultExpanded>
                <KeyValueEditor
                    entries={entries}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    onKeyChange={handleKeyChange}
                    onValueChange={handleValueChange}
                    keyLabel="Option Key"
                    valueLabel="Value"
                    keyPlaceholder="option_name"
                    valuePlaceholder="value"
                    addButtonText="Add Option"
                    description="Additional options passed to the exporter. These are exporter-specific key-value pairs."
                />
            </CollapsibleSection>
        </>
    );
};

export default ExportEditor;

import React, { useCallback, useState, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import CodeEditor from '@/components/atoms/common/CodeEditor';
import { usePluginBuilderStore } from '@/stores/slices/plugin';
import { EXPORTER_OPTIONS, EXPORT_TYPE_OPTIONS } from '@/utilities/plugins/node-types';
import type { IExportData, Exporter, ExportType } from '@/types/plugin';

interface ExportEditorProps {
    node: Node;
}

// Convert to SelectOption format(value, title)
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

    // JSON string state for the editor
    const initialJson = useMemo(() => JSON.stringify(options, null, 2), []);
    const [jsonValue, setJsonValue] = useState(initialJson);
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Sync when options change externally
    const optionsJson = useMemo(() => JSON.stringify(options, null, 2), [options]);

    const updateExport = useCallback((field: string, value: any) => {
        updateNodeData(node.id, { export: { ...exportData, [field]: value } });
    }, [node.id, exportData, updateNodeData]);

    const handleJsonChange = useCallback((value: string) => {
        setJsonValue(value);

        // Try to parse and validate
        try{
            const parsed = JSON.parse(value);
            updateExport('options', parsed);
        }catch(e){
            setJsonError('Invalid JSON syntax');
        }
    }, [updateExport]);

    // Update local state when options change from outside
    React.useEffect(() => {
        // Only update if there's no error(user isn't actively editing with invalid JSON)
        if(!jsonError){
            setJsonValue(optionsJson);
        }
    }, [optionsJson, jsonError]);

    return(
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
                <CodeEditor
                    value={jsonValue}
                    onChange={handleJsonChange}
                    language="json"
                    height={180}
                    error={jsonError}
                    description='Configure export options as JSON. Example: { "material": { "baseColor": [1.0, 0.5, 0.0] } }'
                    placeholder='{ }'
                />
            </CollapsibleSection>
        </>
    );
};

export default ExportEditor;

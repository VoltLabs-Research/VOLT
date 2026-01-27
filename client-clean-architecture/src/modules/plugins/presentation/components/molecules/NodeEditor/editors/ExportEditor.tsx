import React, { useCallback, useState, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/atoms/common/CollapsibleSection';
import FormField from '@/shared/presentation/components/molecules/form/FormField';
import CodeEditor from '@/shared/presentation/components/atoms/common/CodeEditor';
import { usePluginBuilderStore } from '@/modules/plugins/presentation/stores/builder-slice';
import { EXPORTER_OPTIONS, EXPORT_TYPE_OPTIONS } from '@/modules/plugins/presentation/utilities/node-types';
import type { IExportData, Exporter as ExporterType, ExportType } from '@/types/plugin';
import { Exporter } from '@/types/plugin';

interface ExportEditorProps {
    node: Node;
}

const EXPORTER_SELECT_OPTIONS = EXPORTER_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const EXPORT_TYPE_SELECT_OPTIONS = EXPORT_TYPE_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const CHART_TYPE_OPTIONS = [
    { value: 'line', title: 'Line Chart' },
    { value: 'bar', title: 'Bar Chart' },
    { value: 'scatter', title: 'Scatter Plot' },
    { value: 'area', title: 'Area Chart' }
];

const ExportEditor: React.FC<ExportEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const exportData = (node.data?.export || { exporter: 'AtomisticExporter', type: 'glb', options: {} }) as IExportData;

    const { exporter, type, options = {} } = exportData;
    const isChartExporter = exporter === Exporter.CHART;

    const chartOptions = useMemo(() => ({
        xAxisKey: options.xAxisKey || '',
        yAxisKey: options.yAxisKey || '',
        chartType: options.chartType || 'line',
        title: options.title || '',
        xAxisLabel: options.xAxisLabel || '',
        yAxisLabel: options.yAxisLabel || '',
        width: options.width || 1200,
        height: options.height || 800,
        backgroundColor: options.backgroundColor || '#1a1a2e',
        lineColor: options.lineColor || '#3b82f6',
        fillColor: options.fillColor || 'rgba(59, 130, 246, 0.3)',
        showGrid: options.showGrid ?? true,
        showLegend: options.showLegend ?? true
    }), [options]);

    const initialJson = useMemo(() => JSON.stringify(options, null, 2), []);
    const [jsonValue, setJsonValue] = useState(initialJson);
    const [jsonError, setJsonError] = useState<string | null>(null);

    const optionsJson = useMemo(() => JSON.stringify(options, null, 2), [options]);

    const updateExport = useCallback((field: string, value: any) => {
        updateNodeData(node.id, { export: { ...exportData, [field]: value } });
    }, [node.id, exportData, updateNodeData]);

    const updateChartOption = useCallback((key: string, value: any) => {
        const newOptions = { ...options, [key]: value };
        updateExport('options', newOptions);
    }, [options, updateExport]);

    const handleJsonChange = useCallback((value: string) => {
        setJsonValue(value);
        try{
            const parsed = JSON.parse(value);
            updateExport('options', parsed);
            setJsonError(null);
        }catch(e){
            setJsonError('Invalid JSON syntax');
        }
    }, [updateExport]);

    React.useEffect(() => {
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
                    onFieldChange={(_, value) => updateExport('exporter', value as ExporterType)}
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

            {isChartExporter && (
                <>
                    <CollapsibleSection title='Chart Data Mapping' defaultExpanded>
                        <FormField
                            label='X-Axis Key'
                            fieldKey='xAxisKey'
                            fieldType='input'
                            expressionEnabled={true}
                            fieldValue={chartOptions.xAxisKey}
                            onFieldChange={(_, value) => updateChartOption('xAxisKey', value)}
                            inputProps={{ placeholder: 'e.g., timestep or {{ nodeId.path }}' }}
                        />
                        <FormField
                            label='Y-Axis Key'
                            fieldKey='yAxisKey'
                            fieldType='input'
                            expressionEnabled={true}
                            fieldValue={chartOptions.yAxisKey}
                            onFieldChange={(_, value) => updateChartOption('yAxisKey', value)}
                            inputProps={{ placeholder: 'e.g., strain or {{ nodeId.path }}' }}
                        />
                        <FormField
                            label='Chart Type'
                            fieldKey='chartType'
                            fieldType='select'
                            fieldValue={chartOptions.chartType}
                            onFieldChange={(_, value) => updateChartOption('chartType', value)}
                            options={CHART_TYPE_OPTIONS}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection title='Chart Labels' defaultExpanded={false}>
                        <FormField
                            label='Chart Title'
                            fieldKey='title'
                            fieldType='input'
                            fieldValue={chartOptions.title}
                            onFieldChange={(_, value) => updateChartOption('title', value)}
                            inputProps={{ placeholder: 'My Chart Title' }}
                        />
                        <FormField
                            label='X-Axis Label'
                            fieldKey='xAxisLabel'
                            fieldType='input'
                            fieldValue={chartOptions.xAxisLabel}
                            onFieldChange={(_, value) => updateChartOption('xAxisLabel', value)}
                            inputProps={{ placeholder: 'X Axis' }}
                        />
                        <FormField
                            label='Y-Axis Label'
                            fieldKey='yAxisLabel'
                            fieldType='input'
                            fieldValue={chartOptions.yAxisLabel}
                            onFieldChange={(_, value) => updateChartOption('yAxisLabel', value)}
                            inputProps={{ placeholder: 'Y Axis' }}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection title='Chart Dimensions' defaultExpanded={false}>
                        <FormField
                            label='Width (px)'
                            fieldKey='width'
                            fieldType='input'
                            fieldValue={chartOptions.width}
                            onFieldChange={(_, value) => updateChartOption('width', parseInt(value) || 1200)}
                            inputProps={{ type: 'number', min: 400, max: 4000 } as any}
                        />
                        <FormField
                            label='Height (px)'
                            fieldKey='height'
                            fieldType='input'
                            fieldValue={chartOptions.height}
                            onFieldChange={(_, value) => updateChartOption('height', parseInt(value) || 800)}
                            inputProps={{ type: 'number', min: 300, max: 3000 } as any}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection title='Chart Styling' defaultExpanded={false}>
                        <FormField
                            label='Background Color'
                            fieldKey='backgroundColor'
                            fieldType='input'
                            fieldValue={chartOptions.backgroundColor}
                            onFieldChange={(_, value) => updateChartOption('backgroundColor', value)}
                            inputProps={{ placeholder: '#1a1a2e' }}
                        />
                        <FormField
                            label='Line Color'
                            fieldKey='lineColor'
                            fieldType='input'
                            fieldValue={chartOptions.lineColor}
                            onFieldChange={(_, value) => updateChartOption('lineColor', value)}
                            inputProps={{ placeholder: '#3b82f6' }}
                        />
                        <FormField
                            label='Fill Color (for Area charts)'
                            fieldKey='fillColor'
                            fieldType='input'
                            fieldValue={chartOptions.fillColor}
                            onFieldChange={(_, value) => updateChartOption('fillColor', value)}
                            inputProps={{ placeholder: 'rgba(59, 130, 246, 0.3)' }}
                        />
                        <FormField
                            label='Show Grid'
                            fieldKey='showGrid'
                            fieldType='checkbox'
                            fieldValue={chartOptions.showGrid}
                            onFieldChange={(_, value) => updateChartOption('showGrid', value)}
                        />
                        <FormField
                            label='Show Legend'
                            fieldKey='showLegend'
                            fieldType='checkbox'
                            fieldValue={chartOptions.showLegend}
                            onFieldChange={(_, value) => updateChartOption('showLegend', value)}
                        />
                    </CollapsibleSection>
                </>
            )}

            {!isChartExporter && (
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
            )}
        </>
    );
};

export default ExportEditor;

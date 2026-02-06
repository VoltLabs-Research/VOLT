import { useCallback, useState, useMemo, useEffect } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import CodeEditor from '@/shared/presentation/components/CodeEditor';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import { EXPORTER_OPTIONS, EXPORT_TYPE_OPTIONS } from '@/modules/plugin/presentation/utilities/node-types';
import type { IExportData } from '@/modules/plugin/domain/entities';
import { Exporter, ExportType } from '@/modules/plugin/domain/entities';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import type { EditorProps } from '../types';

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

const ExportEditor = ({ node }: EditorProps) => {
    const { values, field } = useNodeForm<IExportData>(node, 'export', {
        exporter: Exporter.ATOMISTIC,
        type: ExportType.GLB,
        options: {}
    });

    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);

    const isChartExporter = values.exporter === Exporter.CHART;
    const options = values.options ?? {};

    const chartOptions = useMemo(() => ({
        xAxisKey: String(options.xAxisKey ?? ''),
        yAxisKey: String(options.yAxisKey ?? ''),
        chartType: String(options.chartType ?? 'line'),
        title: String(options.title ?? ''),
        xAxisLabel: String(options.xAxisLabel ?? ''),
        yAxisLabel: String(options.yAxisLabel ?? '')
    }), [options]);

    const [jsonValue, setJsonValue] = useState(() => JSON.stringify(options, null, 2));
    const optionsJson = useMemo(() => JSON.stringify(options, null, 2), [options]);

    const updateChartOption = useCallback((key: string, value: unknown) => {
        const newOptions = { ...options, [key]: value };
        updateNodeData(node.id, { export: { ...values, options: newOptions } });
    }, [options, values, node.id, updateNodeData]);

    const createChartOptionChangeHandler = useCallback((key: string) => {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            updateChartOption(key, e.target.value);
        };
    }, [updateChartOption]);

    const handleJsonChange = useCallback((value: string) => {
        setJsonValue(value);
        try {
            const parsed = JSON.parse(value);
            updateNodeData(node.id, { export: { ...values, options: parsed } });
        } catch {
            // Invalid JSON, don't update store
        }
    }, [values, node.id, updateNodeData]);

    useEffect(() => {
        setJsonValue(optionsJson);
    }, [optionsJson]);

    return (
        <>
            <CollapsibleSection title='Export Configuration' defaultExpanded>
                <FormField
                    variant='inline'
                    label='Exporter'
                    fieldType='select'
                    {...field('exporter')}
                    options={EXPORTER_SELECT_OPTIONS}
                />
                <FormField
                    variant='inline'
                    label='Export Type'
                    fieldType='select'
                    {...field('type')}
                    options={EXPORT_TYPE_SELECT_OPTIONS}
                />
            </CollapsibleSection>

            {isChartExporter && (
                <>
                    <CollapsibleSection title='Chart Data Mapping' defaultExpanded>
                        <FormField
                            variant='inline'
                            label='X-Axis Key'
                            name='xAxisKey'
                            fieldType='input'
                            value={chartOptions.xAxisKey}
                            onChange={createChartOptionChangeHandler('xAxisKey')}
                            placeholder='e.g., timestep'
                        />
                        <FormField
                            variant='inline'
                            label='Y-Axis Key'
                            name='yAxisKey'
                            fieldType='input'
                            value={chartOptions.yAxisKey}
                            onChange={createChartOptionChangeHandler('yAxisKey')}
                            placeholder='e.g., strain'
                        />
                        <FormField
                            variant='inline'
                            label='Chart Type'
                            name='chartType'
                            fieldType='select'
                            value={chartOptions.chartType}
                            onChange={createChartOptionChangeHandler('chartType')}
                            options={CHART_TYPE_OPTIONS}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection title='Chart Labels'>
                        <FormField
                            variant='inline'
                            label='Chart Title'
                            name='title'
                            fieldType='input'
                            value={chartOptions.title}
                            onChange={createChartOptionChangeHandler('title')}
                            placeholder='My Chart Title'
                        />
                        <FormField
                            variant='inline'
                            label='X-Axis Label'
                            name='xAxisLabel'
                            fieldType='input'
                            value={chartOptions.xAxisLabel}
                            onChange={createChartOptionChangeHandler('xAxisLabel')}
                            placeholder='X Axis'
                        />
                        <FormField
                            variant='inline'
                            label='Y-Axis Label'
                            name='yAxisLabel'
                            fieldType='input'
                            value={chartOptions.yAxisLabel}
                            onChange={createChartOptionChangeHandler('yAxisLabel')}
                            placeholder='Y Axis'
                        />
                    </CollapsibleSection>
                </>
            )}

            {!isChartExporter && (
                <CollapsibleSection title='Export Options' defaultExpanded>
                    <CodeEditor
                        value={jsonValue}
                        onChange={handleJsonChange}
                        rows={6}
                    />
                </CollapsibleSection>
            )}
        </>
    );
};

export default ExportEditor;

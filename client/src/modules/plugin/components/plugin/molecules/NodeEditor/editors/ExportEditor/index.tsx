import { useCallback, useState, useMemo, useEffect } from 'react';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/molecules/NodeEditor/hooks/use-node-editor-form';
import { Exporter } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { EXPORTER_OPTIONS, EXPORT_TYPE_OPTIONS } from '@/modules/plugin/utilities/plugin/node-registry';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import CodeEditor from '@/shared/presentation/components/CodeEditor';
import type { IExportData } from '@/modules/plugin/api/entities/plugin/workflow';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import type { EditorProps } from '../types';
import { EXPORT_EDITOR_DEFAULT_VALUES, exportEditorSchema } from './schema';
import type { ExportEditorFormValues } from './schema';

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

const useExportEditorForm = createNodeEditorForm<ExportEditorFormValues, 'export'>({
    schema: exportEditorSchema,
    defaults: EXPORT_EDITOR_DEFAULT_VALUES,
    dataKey: 'export'
});

const ExportEditor = ({ node }: EditorProps) => {
    const form = useExportEditorForm(node);

    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);

    const watchedExporter = form.watch('exporter');
    const watchedOptions = form.watch('options');

    const isChartExporter = watchedExporter === Exporter.CHART;
    const options = watchedOptions ?? {};

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
        const currentValues = form.getValues();
        const currentOptions = currentValues.options ?? {};
        const newOptions = { ...currentOptions, [key]: value };
        updateNodeData(node.id, { export: { ...currentValues, options: newOptions } as IExportData });
        form.setValue('options', newOptions, { shouldDirty: true });
    }, [form, node.id, updateNodeData]);

    const createChartOptionChangeHandler = useCallback((key: string) => {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            updateChartOption(key, e.target.value);
        };
    }, [updateChartOption]);

    const handleJsonChange = useCallback((value: string) => {
        setJsonValue(value);
        try {
            const parsed = JSON.parse(value);
            const currentValues = form.getValues();
            updateNodeData(node.id, { export: { ...currentValues, options: parsed } as IExportData });
            form.setValue('options', parsed, { shouldDirty: true });
        } catch {
            // Invalid JSON, don't update store
        }
    }, [form, node.id, updateNodeData]);

    useEffect(() => {
        setJsonValue(optionsJson);
    }, [optionsJson]);

    return (
        <>
            <CollapsibleSection title='Export Configuration' defaultExpanded>
                <FormFieldRHF<ExportEditorFormValues>
                    variant='inline'
                    label='Exporter'
                    fieldType='select'
                    name='exporter'
                    control={form.control}
                    options={EXPORTER_SELECT_OPTIONS}
                />
                <FormFieldRHF<ExportEditorFormValues>
                    variant='inline'
                    label='Export Type'
                    fieldType='select'
                    name='type'
                    control={form.control}
                    options={EXPORT_TYPE_SELECT_OPTIONS}
                />
            </CollapsibleSection>

            {isChartExporter && (
                <>
                    <CollapsibleSection title='Chart Data Mapping' defaultExpanded>
                        <FormFieldRHF
                            variant='inline'
                            label='X-Axis Key'
                            name='xAxisKey'
                            fieldType='input'
                            value={chartOptions.xAxisKey}
                            onChange={createChartOptionChangeHandler('xAxisKey')}
                            placeholder='e.g., timestep'
                        />
                        <FormFieldRHF
                            variant='inline'
                            label='Y-Axis Key'
                            name='yAxisKey'
                            fieldType='input'
                            value={chartOptions.yAxisKey}
                            onChange={createChartOptionChangeHandler('yAxisKey')}
                            placeholder='e.g., strain'
                        />
                        <FormFieldRHF
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
                        <FormFieldRHF
                            variant='inline'
                            label='Chart Title'
                            name='title'
                            fieldType='input'
                            value={chartOptions.title}
                            onChange={createChartOptionChangeHandler('title')}
                            placeholder='My Chart Title'
                        />
                        <FormFieldRHF
                            variant='inline'
                            label='X-Axis Label'
                            name='xAxisLabel'
                            fieldType='input'
                            value={chartOptions.xAxisLabel}
                            onChange={createChartOptionChangeHandler('xAxisLabel')}
                            placeholder='X Axis'
                        />
                        <FormFieldRHF
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

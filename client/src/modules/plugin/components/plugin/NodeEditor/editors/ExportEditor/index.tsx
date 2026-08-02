import { useState, useEffect } from 'react';
import useNodeEditorForm from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import { Exporter } from '@volt/contracts/modules/plugin/enums';
import { EXPORTER_OPTIONS, EXPORT_TYPE_OPTIONS } from '@/modules/plugin/utils/plugin/node-registry';
import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import CodeEditor from '@/shared/ui/components/CodeEditor';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';
import { EXPORT_EDITOR_DEFAULT_VALUES } from './schema';
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
    {
        value: 'line',
        title: 'Line Chart'
    },
    {
        value: 'bar',
        title: 'Bar Chart'
    },
    {
        value: 'scatter',
        title: 'Scatter Plot'
    },
    {
        value: 'area',
        title: 'Area Chart'
    }
];

const ExportEditor = ({ node }: EditorProps) => {
    const form = useNodeEditorForm<ExportEditorFormValues>(node, 'export', EXPORT_EDITOR_DEFAULT_VALUES);

    const isChartExporter = form.watch('exporter') === Exporter.CHART;
    const options = form.watch('options') ?? {};

    // String() is required: `options` holds hand-authored JSON typed as unknown.
    const chartOptions = {
        xAxisKey: String(options.xAxisKey ?? ''),
        yAxisKey: String(options.yAxisKey ?? ''),
        chartType: String(options.chartType ?? 'line'),
        title: String(options.title ?? ''),
        xAxisLabel: String(options.xAxisLabel ?? ''),
        yAxisLabel: String(options.yAxisLabel ?? '')
    };

    const optionsJson = JSON.stringify(options, null, 2);
    const [jsonValue, setJsonValue] = useState(optionsJson);

    const createChartOptionChangeHandler = (key: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            form.setValue('options', {
                ...form.getValues().options,
                [key]: e.target.value
            }, { shouldDirty: true });
        };

    const handleJsonChange = (value: string) => {
        setJsonValue(value);
        try {
            form.setValue('options', JSON.parse(value), { shouldDirty: true });
        } catch {
            // Invalid JSON, don't update store
        }
    };

    useEffect(() => {
        setJsonValue(optionsJson);
    }, [optionsJson]);

    return (
        <>
            <FormSection title='Export Configuration'>
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
            </FormSection>

            {isChartExporter && (
                <>
                    <FormSection title='Chart Data Mapping'>
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
                    </FormSection>

                    <FormSection title='Chart Labels'>
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
                    </FormSection>
                </>
            )}

            {!isChartExporter && (
                <FormSection title='Export Options'>
                    <CodeEditor
                        value={jsonValue}
                        onChange={handleJsonChange}
                        rows={6}
                    />
                </FormSection>
            )}
        </>
    );
};

export default ExportEditor;

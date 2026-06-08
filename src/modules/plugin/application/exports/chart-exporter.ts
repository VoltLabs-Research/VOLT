import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { BubbleDataPoint, ChartConfiguration, ChartTypeRegistry, Point } from 'chart.js';

import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { getNestedValue, stageExportBufferUpload } from '@/modules/plugin/application/exports/export-node-processor-shared';
import type { ChartExportOptions, ExportExecutionInput } from '@/modules/plugin/application/exports/export-node-processor-types';
import type { MsgpackObject, MsgpackValue } from '@/support/serialization/msgpack-value';

interface ChartPoint {
    x: string | number;
    y: number;
}

type SupportedChartType = 'line' | 'bar' | 'scatter';
type SupportedChartDatasetValue = number | [number, number] | Point | BubbleDataPoint | null;

const extractChartData = (
    decodedPayload: MsgpackObject,
    options: ChartExportOptions
): ChartPoint[] => {
    const readChartPoint = (xValue: MsgpackValue | undefined, yValue: MsgpackValue | undefined): ChartPoint | null => {
        if (typeof xValue !== 'string' && typeof xValue !== 'number') {
            return null;
        }

        if (typeof yValue !== 'number') {
            return null;
        }

        return {
            x: xValue,
            y: yValue
        };
    };

    const xAxis = getNestedValue(decodedPayload, options.xAxisKey);
    const yAxis = getNestedValue(decodedPayload, options.yAxisKey);

    if (!Array.isArray(xAxis) || !Array.isArray(yAxis)) {
        return [];
    }

    return xAxis
        .map((x, index) => readChartPoint(x, yAxis[index]))
        .filter((point): point is ChartPoint => point !== null);
};

export const exportChartArtifact = async (
    input: ExportExecutionInput,
    objectPath: string,
    ownerClusterId: string,
    options: ChartExportOptions
): Promise<boolean> => {
    const chartData = extractChartData(input.decodedPayload, options);
    if (chartData.length === 0) {
        return false;
    }

    const {
        chartType: requestedChartType,
        width = 1200,
        height = 800,
        backgroundColor = '#1a1a2e',
        title = '',
        lineColor = '#3b82f6',
        fillColor = 'rgba(59, 130, 246, 0.3)',
        showLegend = true,
        showGrid = true,
        xAxisLabel = '',
        yAxisLabel = ''
    } = options;
    const chartCanvas = new ChartJSNodeCanvas({
        width,
        height,
        backgroundColour: backgroundColor
    });
    const chartType: SupportedChartType = requestedChartType === 'area'
        ? 'line'
        : requestedChartType;
    const chartConfiguration: ChartConfiguration<keyof ChartTypeRegistry, SupportedChartDatasetValue[], string> = {
        type: chartType,
        data: {
            labels: chartType === 'scatter'
                ? undefined
                : chartData.map((point) => `${point.x}`),
            datasets: [{
                label: title.length > 0 ? title : 'Data',
                data: chartType === 'scatter'
                    ? chartData.map((point) => ({ x: Number(point.x), y: point.y }))
                    : chartData.map((point) => point.y),
                borderColor: lineColor,
                backgroundColor: fillColor,
                fill: requestedChartType === 'area',
                tension: 0.1,
                pointRadius: chartType === 'scatter' ? 4 : 2,
                borderWidth: 2
            }]
        },
        options: {
            responsive: false,
            animation: false,
            plugins: {
                legend: {
                    display: showLegend,
                    labels: { color: '#ffffff' }
                },
                title: {
                    display: title.length > 0,
                    text: title,
                    color: '#ffffff'
                }
            },
            scales: {
                x: {
                    title: {
                        display: xAxisLabel.length > 0,
                        text: xAxisLabel,
                        color: '#ffffff'
                    },
                    grid: {
                        display: showGrid,
                        color: 'rgba(255,255,255,0.1)'
                    },
                    ticks: { color: '#cccccc' }
                },
                y: {
                    title: {
                        display: yAxisLabel.length > 0,
                        text: yAxisLabel,
                        color: '#ffffff'
                    },
                    grid: {
                        display: showGrid,
                        color: 'rgba(255,255,255,0.1)'
                    },
                    ticks: { color: '#cccccc' }
                }
            }
        }
    };
    const buffer = await chartCanvas.renderToBuffer(chartConfiguration);

    await stageExportBufferUpload(input, {
        exporter: 'ChartExporter',
        bucket: ObjectBucketName.Plugins,
        buffer,
        contentType: 'image/png',
        objectPath,
        ownerClusterId
    });

    return true;
};

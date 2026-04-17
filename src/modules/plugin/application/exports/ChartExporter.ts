import path from 'node:path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { BubbleDataPoint, ChartConfiguration, ChartTypeRegistry, Point } from 'chart.js';

import { ObjectBucketName } from '@/core/storage/contracts/http.objectStore';
import { isRecord } from '@/support/type-guards/isRecord';
import { buildArtifactReportInput, getNestedValue } from '@/modules/plugin/application/exports/ExportNodeProcessor.shared';
import type { ChartExportOptions, ExportExecutionInput } from '@/modules/plugin/application/exports/ExportNodeProcessor.types';

interface ChartPoint {
    x: string | number;
    y: number;
}

type SupportedChartType = 'line' | 'bar' | 'scatter';
type SupportedChartDatasetValue = number | [number, number] | Point | BubbleDataPoint | null;

const extractChartData = (
    decodedPayload: Record<string, unknown>,
    options: ChartExportOptions
): ChartPoint[] => {
    const readChartPoint = (xValue: unknown, yValue: unknown): ChartPoint | null => {
        if (typeof xValue !== 'string' && typeof xValue !== 'number') {
            return null;
        }

        if (typeof yValue !== 'number' || !Number.isFinite(yValue)) {
            return null;
        }

        return {
            x: xValue,
            y: yValue
        };
    };

    const xAxis = getNestedValue(decodedPayload, options.xAxisKey);
    const yAxis = getNestedValue(decodedPayload, options.yAxisKey);

    if (Array.isArray(xAxis) && Array.isArray(yAxis)) {
        return xAxis
            .map((x, index) => readChartPoint(x, yAxis[index]))
            .filter((point): point is ChartPoint => point !== null);
    }

    if (!Array.isArray(decodedPayload)) {
        return [];
    }

    return decodedPayload
        .map((entry) => {
            if (!isRecord(entry)) {
                return null;
            }

            return {
                x: entry[options.xAxisKey],
                y: entry[options.yAxisKey]
            };
        })
        .map((entry) => entry ? readChartPoint(entry.x, entry.y) : null)
        .filter((entry): entry is ChartPoint => entry !== null);
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

    if (options.chartType === 'scatter' && chartData.some((point) => !Number.isFinite(Number(point.x)))) {
        return false;
    }

    const width = options.width || 1200;
    const height = options.height || 800;
    const chartCanvas = new ChartJSNodeCanvas({
        width,
        height,
        backgroundColour: options.backgroundColor || '#1a1a2e'
    });
    const chartType: SupportedChartType = options.chartType === 'area'
        ? 'line'
        : options.chartType;
    const chartConfiguration: ChartConfiguration<keyof ChartTypeRegistry, SupportedChartDatasetValue[], string> = {
        type: chartType,
        data: {
            labels: chartType === 'scatter'
                ? undefined
                : chartData.map((point) => String(point.x)),
            datasets: [{
                label: options.title || 'Data',
                data: chartType === 'scatter'
                    ? chartData.map((point) => ({ x: Number(point.x), y: point.y }))
                    : chartData.map((point) => point.y),
                borderColor: options.lineColor || '#3b82f6',
                backgroundColor: options.fillColor || 'rgba(59, 130, 246, 0.3)',
                fill: options.chartType === 'area',
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
                    display: options.showLegend ?? true,
                    labels: { color: '#ffffff' }
                },
                title: {
                    display: Boolean(options.title),
                    text: options.title || '',
                    color: '#ffffff'
                }
            },
            scales: {
                x: {
                    title: {
                        display: Boolean(options.xAxisLabel),
                        text: options.xAxisLabel || '',
                        color: '#ffffff'
                    },
                    grid: {
                        display: options.showGrid ?? true,
                        color: 'rgba(255,255,255,0.1)'
                    },
                    ticks: { color: '#cccccc' }
                },
                y: {
                    title: {
                        display: Boolean(options.yAxisLabel),
                        text: options.yAxisLabel || '',
                        color: '#ffffff'
                    },
                    grid: {
                        display: options.showGrid ?? true,
                        color: 'rgba(255,255,255,0.1)'
                    },
                    ticks: { color: '#cccccc' }
                }
            }
        }
    };
    const buffer = await chartCanvas.renderToBuffer(chartConfiguration);

    await input.artifactUploadBatch.stageBufferUpload({
        ownerClusterId,
        bucket: ObjectBucketName.Plugins,
        objectKey: objectPath,
        buffer,
        contentType: 'image/png',
        fileName: path.basename(objectPath),
        reportArtifact: buildArtifactReportInput(
            input,
            'ChartExporter',
            input.exposure.export!,
            objectPath,
            ObjectBucketName.Plugins
        )
    });

    return true;
};

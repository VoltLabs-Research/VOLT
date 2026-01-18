import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration, ChartTypeRegistry } from 'chart.js';
import { ChartDataPoint, ChartType, IChartExporter, IChartExportOptions } from '@modules/trajectory/domain/port/exporters/ChartExporter';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { inject, injectable } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import getNestedValue from '@shared/infrastructure/utilities/get-nested-value';

@injectable()
export default class ChartExporter implements IChartExporter {
    private DEFAULT_WIDTH = 1200;
    private DEFAULT_HEIGHT = 800;

    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ) { }

    /**
     * Extract chart data from data bsaed on x/y axis keys.
     */
    private extractChartData(
        data: any,
        xAxisKey: string,
        yAxisKey: string
    ): ChartDataPoint[] {
        if (!data) return [];

        // If data has the keys as arrays
        if (data[xAxisKey] && data[yAxisKey]) {
            const xValues = Array.isArray(data[xAxisKey])
                ? data[xAxisKey]
                : [data[xAxisKey]];

            const yValues = Array.isArray(data[yAxisKey])
                ? data[yAxisKey]
                : [data[yAxisKey]];

            return xValues.map((x: any, index: number) => ({
                x,
                y: yValues[index] ?? 0
            }));
        }

        // If data is an array of objects
        if (Array.isArray(data)) {
            return data.map((item: any) => ({
                x: item[xAxisKey],
                y: item[yAxisKey]
            }));
        }

        const xData = getNestedValue(data, xAxisKey);
        const yData = getNestedValue(data, yAxisKey);
        if (Array.isArray(xData) && Array.isArray(yData)) {
            return xData.map((x: any, index: number) => ({
                x,
                y: yData[index]
            }));
        }

        return [];
    }

    /**
     * Map ChartType enum to Chart.js chart type.
     */
    private getChartJsType(chartType: ChartType): keyof ChartTypeRegistry {
        switch (chartType) {
            case ChartType.Line:
                return 'line';
            case ChartType.Bar:
                return 'bar';
            case ChartType.Scatter:
                return 'scatter';
            case ChartType.Area:
                // NOTE: Area is line with fill.
                return 'line';
            default:
                return 'line';
        }
    }

    /**
     * Generate PNG buffer from chart data.
     */
    async generatePNG(data: any, options: IChartExportOptions): Promise<Buffer> {
        const width = options.width || this.DEFAULT_WIDTH;
        const height = options.height || this.DEFAULT_HEIGHT;

        const chartJSNodeCanvas = new ChartJSNodeCanvas({
            width,
            height,
            backgroundColour: options.backgroundColor || '#1a1a2e'
        });

        const chartData = this.extractChartData(data, options.xAxisKey, options.yAxisKey);
        if (chartData.length === 0) {
            throw new Error(`No chart data found for keys: xAxis="${options.xAxisKey}", yAxis="${options.yAxisKey}"`);
        }

        const configuration = this.buildChartConfig(chartData, options);
        const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);

        return buffer;
    }

    /**
     * Export chart to MinIO storage.
     */
    async toStorage(
        data: any,
        objectName: string,
        options: IChartExportOptions
    ): Promise<void> {
        try {
            const pngBuffer = await this.generatePNG(data, options);
            await this.storageService.upload(
                SYS_BUCKETS.PLUGINS,
                objectName,
                pngBuffer,
                { 'Content-Type': 'image/png' }
            );
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Generate chart configuration for Chart.js.
     */
    private buildChartConfig(
        chartData: ChartDataPoint[],
        options: IChartExportOptions
    ): ChartConfiguration {
        const chartType = this.getChartJsType(options.chartType);
        const isArea = options.chartType === ChartType.Area;
        const isScatter = options.chartType === ChartType.Scatter;

        const labels = isScatter ? undefined : chartData.map((data) => String(data.x));
        const dataValues = isScatter
            ? chartData.map((data) => ({ x: data.x, y: data.y }))
            : chartData.map((data) => data.y);

        const lineColor = options.lineColor || '#3b82f6';
        const fillColor = options.fillColor || 'rgba(59, 130, 246, 0.3)';
        const backgroundColor = options.backgroundColor || '#1a1a2e';

        return {
            type: chartType,
            data: {
                labels,
                datasets: [{
                    label: options.title || 'Data',
                    // @ts-ignore
                    data: dataValues,
                    borderColor: lineColor,
                    backgroundColor: isArea || options.chartType === ChartType.Bar ? fillColor : lineColor,
                    fill: isArea,
                    tension: 0.1,
                    pointRadius: isScatter ? 4 : 2,
                    pointBackgroundColor: lineColor,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    legend: {
                        display: options.showLegend ?? true,
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 14
                            }
                        }
                    },
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        color: '#ffffff',
                        font: {
                            size: 18,
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: !!options.xAxisLabel,
                            text: options.xAxisLabel || '',
                            color: '#ffffff',
                            font: {
                                size: 14
                            }
                        },
                        grid: {
                            display: options.showGrid ?? true,
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#cccccc',
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: !!options.yAxisLabel,
                            text: options.yAxisLabel || '',
                            color: '#ffffff',
                            font: {
                                size: 14
                            }
                        },
                        grid: {
                            display: options.showGrid ?? true,
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#cccccc'
                        }
                    }
                }
            },
            plugins: [{
                id: 'customCanvasBackgroundColor',
                beforeDraw: (chart: any) => {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.globalCompositeOperation = 'destination-over';
                    ctx.fillStyle = backgroundColor;
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            }]
        };
    }
};
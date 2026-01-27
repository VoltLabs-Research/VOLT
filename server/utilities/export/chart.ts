/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration, ChartTypeRegistry } from 'chart.js';
import { ChartType, IChartExportOptions } from '@/types/models/plugin';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import logger from '@/logger';

interface ChartDataPoint {
    x: number | string;
    y: number;
}

class ChartExporter {
    private defaultWidth = 1200;
    private defaultHeight = 800;

    /**
     * Extract chart data from exposure data based on x/y axis keys
     */
    private extractChartData(data: any, xAxisKey: string, yAxisKey: string): ChartDataPoint[] {
        if (!data) return [];

        // If data has the keys as arrays
        if (data[xAxisKey] && data[yAxisKey]) {
            const xValues = Array.isArray(data[xAxisKey]) ? data[xAxisKey] : [data[xAxisKey]];
            const yValues = Array.isArray(data[yAxisKey]) ? data[yAxisKey] : [data[yAxisKey]];

            return xValues.map((x: any, index: number) => ({
                x: x,
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

        // Try nested paths like "items.x" and "items.y"
        const getNestedValue = (obj: any, path: string): any => {
            return path.split('.').reduce((acc, part) => acc?.[part], obj);
        };

        const xData = getNestedValue(data, xAxisKey);
        const yData = getNestedValue(data, yAxisKey);

        if (Array.isArray(xData) && Array.isArray(yData)) {
            return xData.map((x: any, index: number) => ({
                x: x,
                y: yData[index] ?? 0
            }));
        }

        return [];
    }

    /**
     * Map ChartType enum to Chart.js chart type
     */
    private getChartJsType(chartType: ChartType): keyof ChartTypeRegistry {
        switch (chartType) {
            case ChartType.LINE:
                return 'line';
            case ChartType.BAR:
                return 'bar';
            case ChartType.SCATTER:
                return 'scatter';
            case ChartType.AREA:
                return 'line'; // Area is line with fill
            default:
                return 'line';
        }
    }

    /**
     * Generate chart configuration for Chart.js
     */
    private buildChartConfig(
        chartData: ChartDataPoint[],
        options: IChartExportOptions
    ): ChartConfiguration {
        const chartType = this.getChartJsType(options.chartType);
        const isArea = options.chartType === ChartType.AREA;
        const isScatter = options.chartType === ChartType.SCATTER;

        const labels = isScatter ? undefined : chartData.map(d => String(d.x));
        const dataValues = isScatter
            ? chartData.map(d => ({ x: d.x as number, y: d.y }))
            : chartData.map(d => d.y);

        const lineColor = options.lineColor || '#3b82f6';
        const fillColor = options.fillColor || 'rgba(59, 130, 246, 0.3)';
        const backgroundColor = options.backgroundColor || '#1a1a2e';

        return {
            type: chartType,
            data: {
                labels,
                datasets: [{
                    label: options.title || 'Data',
                    data: dataValues,
                    borderColor: lineColor,
                    backgroundColor: isArea || options.chartType === ChartType.BAR ? fillColor : lineColor,
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

    /**
     * Generate PNG buffer from chart data
     */
    async generatePNG(data: any, options: IChartExportOptions): Promise<Buffer> {
        const width = options.width || this.defaultWidth;
        const height = options.height || this.defaultHeight;

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
     * Export chart to MinIO storage
     */
    async toPNGMinIO(data: any, objectName: string, options: IChartExportOptions): Promise<void> {
        try {
            const pngBuffer = await this.generatePNG(data, options);

            await storage.put(
                SYS_BUCKETS.PLUGINS,
                objectName,
                pngBuffer,
                { 'Content-Type': 'image/png' }
            );

            logger.info(`[ChartExporter] Successfully exported chart to ${objectName}`);
        } catch (error: any) {
            logger.error(`[ChartExporter] Failed to export chart: ${error.message}`);
            throw error;
        }
    }
}

export default ChartExporter;

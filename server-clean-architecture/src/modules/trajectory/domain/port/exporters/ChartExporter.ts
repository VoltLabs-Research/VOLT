export enum ChartType{
    Line = 'line',
    Bar = 'bar',
    Scatter = 'scatter',
    Area = 'area'
};

export interface ChartDataPoint{
    x: number | string;
    y: number;
};

export interface IChartExportOptions{
    xAxisKey: string;
    yAxisKey: string;
    chartType: ChartType;
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    width?: number;
    height?: number;
    backgroundColor?: string;
    lineColor?: string;
    fillColor?: string;
    showGrid?: boolean;
    showLegend?: boolean;
};

export interface IChartExporter{
    toStorage(
        data: any,
        objectName: string,
        options?: IChartExportOptions
    ): Promise<void>;
};
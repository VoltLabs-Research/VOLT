import React from 'react';
import { ChartContainer } from '@mui/x-charts/ChartContainer';
import { alpha } from '@mui/material/styles';
import {
    LinePlot,
    MarkPlot,
    AreaPlot,
    lineElementClasses,
    markElementClasses,
    areaElementClasses
} from '@mui/x-charts/LineChart';

const TinyLineChart = ({ lineColor, xLabels, pData }) => {
    const gradId = React.useId();

    return (
        <ChartContainer
            width={300}
            series={[
                { type: 'line', data: pData, color: lineColor, area: true },
            ]}
            xAxis={[{ scaleType: 'point', data: xLabels, position: 'none' }]}
            yAxis={[{ position: 'none' }]}
            sx={{
                [`& .${lineElementClasses.root}`]: {
                    stroke: lineColor,
                    strokeWidth: 2,
                },
                [`& .${markElementClasses.root}`]: {
                    stroke: lineColor,
                    r: 0,
                    fill: '#fff',
                    strokeWidth: 2,
                },
                [`& .${areaElementClasses.root}`]: {
                    fill: `url(#${gradId})`,
                },
            }}
            disableAxisListener
        >
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={alpha(lineColor, 0.25)} />
                    <stop offset="100%" stopColor={alpha(lineColor, 0.00)} />
                </linearGradient>
            </defs>
    
          <AreaPlot />
          <LinePlot />
          <MarkPlot />
        </ChartContainer>
    );
};

export default TinyLineChart;
import React, { useMemo } from 'react';
import { alpha } from '@mui/material/styles';
import { LineChart } from '@mui/x-charts/LineChart';

interface Props {
    lineColor: string;
    xLabels: string[];
    pData: number[];
    yDomain?: { min: number; max: number };
    width?: number;
    height?: number;
}

const TinyLineChart: React.FC<Props> = ({ lineColor, xLabels, pData, yDomain, width = 300, height = 80 }) => {
    const { labels, data } = useMemo(() => {
        const L = Math.max(xLabels?.length || 0, pData?.length || 0);
        const safeLabels = Array.from({ length: L }, (_, i) => xLabels?.[i] ?? '');
        const safeData = Array.from({ length: L }, (_, i) => {
            const v = Number(pData?.[i]);
            return Number.isFinite(v) ? v : 0;
        });
        return { labels: safeLabels, data: safeData };
    }, [xLabels, pData]);

    const areaColor = alpha(lineColor, 0.25);

    return(
        <LineChart
            width={width}
            height={height}
            series={[{ data, area: true, color: lineColor }]}
            xAxis={[{ scaleType: 'point', data: labels, position: 'none' }]}
            yAxis={[{ position: 'none', min: yDomain?.min, max: yDomain?.max }]}
            slotProps={{
                legend: { hidden: true } as any,
            }}
            sx={{
                '& .MuiLineElement-root': { strokeWidth: 2 },
                '& .MuiAreaElement-root': { fill: areaColor },
                '& .MuiMarkElement-root': { r: 0 },
            }}
        />
    );
};

export default TinyLineChart;

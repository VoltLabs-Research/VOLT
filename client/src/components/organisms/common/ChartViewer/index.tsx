import React, { useEffect, useState, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';
import { decode } from '@msgpack/msgpack';
import Loader from '@/components/atoms/common/Loader';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import pluginApi from '@/services/api/plugin';

interface ChartViewerProps {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    options: {
        title?: string;
        xAxis?: { label?: string; key: string };
        yAxis?: { label?: string; key: string };
        fill?: boolean;
        color?: string;
    };
    filename: string;
    onClose?: () => void;
}

const ChartViewer: React.FC<ChartViewerProps> = ({
    trajectoryId,
    analysisId,
    exposureId,
    timestep,
    options,
    filename,
    onClose
}) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchData = async() => {
            setLoading(true);
            setError(null);
            try{
                const response = await pluginApi.getFile(
                    trajectoryId,
                    analysisId,
                    exposureId,
                    timestep,
                    filename
                );
                const decoded = decode(new Uint8Array(response));
                if(mounted){
                    setData(decoded);
                }
            }catch(err: any){
                console.error('Failed to fetch chart data:', err);
                if(mounted){
                    setError(err.message || 'Failed to load data');
                }
            }finally{
                if(mounted){
                    setLoading(false);
                }
            }
        };

        fetchData();

        return() => {
            mounted = false;
        };
    }, [trajectoryId, analysisId, exposureId, timestep, filename]);

    const chartData = useMemo(() => {
        if(!data) return [];

        const xKey = options.xAxis?.key || 'x';
        const yKey = options.yAxis?.key || 'y';

        if(Array.isArray(data)) {
            return data.map((d: any) => ({
                x: d[xKey],
                y: d[yKey]
            }));
        }else if(data && typeof data === 'object'){
            const xValues = data[xKey] || [];
            const yValues = data[yKey] || [];
            return xValues.map((x: any, index: number) => ({
                x,
                y: yValues[index]
            }));
        }

        return [];
    }, [data, options]);

    const xMeta = useMemo(() => {
        if(!chartData || chartData.length === 0){
            return {
                isNumeric: false,
                interval: 'preserveStartEnd' as const,
                tickAngle: 0,
                tickHeight: 30
            };
        }

        const sample = chartData[0]?.x;
        const isNumeric =
            typeof sample === 'number' ||
            (typeof sample === 'string' && sample.trim() !== '' && Number.isFinite(Number(sample)));

        const n = chartData.length;

        // show ~8–12 ticks max(avoid clutter)
        const desiredTicks = 10;
        const step = n > desiredTicks ? Math.ceil(n / desiredTicks) : 0;

        // rotate if too dense
        const tickAngle = n > 12 ? -35 : 0;
        const tickHeight = tickAngle !== 0 ? 55 : 30;

        return{
            isNumeric,
            interval: step === 0 ? 0 : step,
            tickAngle,
            tickHeight
        };
    }, [chartData]);

    const formatTick = (value: any) => {
        if(value == null) return '';

        // numeric formatting
        if(xMeta.isNumeric){
            const num = Number(value);
            if(!Number.isFinite(num)) return String(value);
            // keep compact but readable
            if(Math.abs(num) >= 10000) return num.toExponential(2);
            if(Math.abs(num) < 0.01 && num !== 0) return num.toExponential(2);
            return Number.isInteger(num) ? num.toString() : num.toFixed(3);
        }

        // string/category formatting
        const str = String(value);
        if(str.length <= 10) return str;
        return `${str.slice(0, 8)}…`;
    };

    if(loading){
        return(
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    width: '100%'
                }}
            >
                <Loader scale={0.7} />
            </div>
        );
    }

    if(error){
        return(
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    width: '100%'
                }}
            >
                <span style={{ color: '#ff6b6b' }}>{error}</span>
            </div>
        );
    }

    if(!data || chartData.length === 0) return null;

    const chartColor = options.color || '#3b82f6';
    const ChartComponent = options.fill ? AreaChart : LineChart;

    return(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '10px 12px',
                gap: '8px',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '2px 4px'
                }}
            >
                <div
                    className="chart-viewer-drag-area"
                    style={{
                        flex: 1,
                        height: '20px',
                        cursor: 'grab',
                        userSelect: 'none'
                    }}
                />
                <div>
                    <WindowIcons onClose={() => {
                        console.log('ChartViewer close button clicked');
                        onClose?.();
                    }} />
                </div>
            </div>
            {(options.title || options.xAxis?.label || options.yAxis?.label) && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '2px 4px'
                    }}
                >
                    <div
                        style={{
                            color: '#ffffff',
                            fontSize: 15,
                            fontWeight: 600,
                            opacity: 0.95,
                            letterSpacing: 0.2
                        }}
                    >
                        {options.title || ''}
                    </div>

                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                        {options.yAxis?.label || options.yAxis?.key || 'Value'}
                    </div>
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ChartComponent
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 8, bottom: 28 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255, 255, 255, 0.08)"
                        />

                        <XAxis
                            dataKey="x"
                            type={xMeta.isNumeric ? 'number' : 'category'}
                            domain={xMeta.isNumeric ? ['auto', 'auto'] : undefined}
                            interval={xMeta.interval as any}
                            minTickGap={18}
                            height={xMeta.tickHeight}
                            tickFormatter={formatTick}
                            tick={{
                                fill: '#ffffff',
                                fontSize: 12,
                                angle: xMeta.tickAngle,
                                textAnchor: xMeta.tickAngle !== 0 ? 'end' : 'middle'
                            }}
                            stroke="#ffffff"
                            label={{
                                value: options.xAxis?.label || '',
                                position: 'insideBottom',
                                offset: -6,
                                style: { fill: '#ffffff', fontSize: 13, opacity: 0.9 }
                            }}
                        />

                        <YAxis
                            tick={{ fill: '#ffffff', fontSize: 12 }}
                            stroke="#ffffff"
                            width={50}
                            label={{
                                value: options.yAxis?.label || '',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fill: '#ffffff', fontSize: 13, opacity: 0.9 }
                            }}
                        />

                        <Tooltip
                            isAnimationActive={false}
                            contentStyle={{
                                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.18)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                padding: '8px 10px'
                            }}
                            labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                            itemStyle={{ color: '#ffffff' }}
                            formatter={(val: any) => [
                                val,
                                options.yAxis?.label || options.yAxis?.key || 'y'
                            ]}
                            labelFormatter={(lab: any) =>
                                `${options.xAxis?.label || options.xAxis?.key || 'x'}: ${lab}`
                            }
                        />

                        <Legend
                            verticalAlign="top"
                            height={24}
                            wrapperStyle={{
                                fontSize: 12,
                                color: '#ffffff',
                                opacity: 0.85
                            }}
                        />

                        {options.fill ? (
                            <Area
                                type="monotone"
                                dataKey="y"
                                stroke={chartColor}
                                fill={chartColor}
                                fillOpacity={0.25}
                                strokeWidth={2}
                                name={options.yAxis?.label || 'Value'}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="y"
                                stroke={chartColor}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                                name={options.yAxis?.label || 'Value'}
                            />
                        )}
                    </ChartComponent>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartViewer;

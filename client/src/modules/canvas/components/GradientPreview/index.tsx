import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { GRADIENT_CSS, formatLegendValue } from '../../utils/gradient-legend';
import { useState, useRef } from 'react';

import './GradientPreview.css';

interface GradientPreviewProps {
    gradient: string;
    startValue: number;
    endValue: number;
}

const formatValue = formatLegendValue;

const GradientPreview = ({ gradient, startValue, endValue }: GradientPreviewProps) => {
    const [tooltipValue, setTooltipValue] = useState<string | null>(null);
    const [tooltipX, setTooltipX] = useState(0);
    const barRef = useRef<HTMLDivElement>(null);
    const calculateValue = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!barRef.current) return null;
        const rect = barRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        const value = startValue + ratio * (endValue - startValue);
        return {
            value: formatValue(value),
            x
        };
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const result = calculateValue(e);
        if (!result) return;
        setTooltipValue(result.value);
        setTooltipX(result.x);
    };

    const handleMouseLeave = () => {
        setTooltipValue(null);
    };

    const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
        const result = calculateValue(e);
        if (!result) return;

        await copyTextToClipboard(result.value, {
            successMessage: `Value ${result.value} copied to clipboard`
        });
    };

    const gradientStyle = GRADIENT_CSS[gradient];

    return (
        <div className='w-full canvas-gradient-preview'>
            <div className='rounded-lg relative cursor-pointer canvas-gradient-bar' ref={barRef} style={{ background: gradientStyle }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}>
                {tooltipValue !== null && (
                    <div className='rounded-lg absolute canvas-gradient-tooltip text-xs' style={{ left: tooltipX }}>
                        {tooltipValue}
                    </div>
                )}
            </div>
            <div className='flex flex-row items-center justify-between canvas-gradient-labels text-xs'>
                <span>{formatValue(startValue)}</span>
                <span>{formatValue(endValue)}</span>
            </div>
        </div>
    );
};

export default GradientPreview;

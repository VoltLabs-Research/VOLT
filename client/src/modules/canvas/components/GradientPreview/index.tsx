import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { GRADIENT_CSS, formatLegendValue } from '../../utils/gradient-legend';
import { Box, Row } from '@voltstack/bravais';
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
        return { value: formatValue(value), x };
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
        <Box width='max' className="canvas-gradient-preview">
            <Box ref={barRef} radius='sm' position='relative' cursor='pointer' className="canvas-gradient-bar" style={{ background: gradientStyle }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}>
                {tooltipValue !== null && (
                    <Box position='absolute' radius='sm' className="canvas-gradient-tooltip font-size-05" style={{ left: tooltipX }}>
                        {tooltipValue}
                    </Box>
                )}
            </Box>
            <Row justify='between' className="canvas-gradient-labels font-size-05">
                <span>{formatValue(startValue)}</span>
                <span>{formatValue(endValue)}</span>
            </Row>
        </Box>
    );
};

export default GradientPreview;

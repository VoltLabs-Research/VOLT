import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { Box, Row } from '@voltstack/bravais';
import { useState, useRef } from 'react';

import './GradientPreview.css';

const GRADIENT_CSS: Record<string, string> = {
    Viridis: 'linear-gradient(to right, #440154, #482878, #3e4a89, #31688e, #26838f, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)',
    Plasma: 'linear-gradient(to right, #0d0887, #46039f, #7201a8, #9c179e, #bd3786, #d8576b, #ed7953, #fb9f3a, #fdca26, #f0f921)',
    Magma: 'linear-gradient(to right, #000004, #1c1044, #51127c, #822681, #b73779, #e75263, #fb8761, #fec287, #fcfdbf)',
    Inferno: 'linear-gradient(to right, #000004, #1b0c42, #4a0c6b, #781c6d, #a52c60, #cf4446, #ed6925, #fb9a06, #fcffa4)',
    Cividis: 'linear-gradient(to right, #002051, #123b66, #33466d, #505978, #6b6c7e, #8d7e7c, #b99175, #ddb063, #fdea45)',
    RdBu: 'linear-gradient(to right, #67001f, #b2182b, #d6604d, #f4a582, #fddbc7, #f7f7f7, #d1e5f0, #92c5de, #4393c3, #2166ac, #053061)',
    Coolwarm: 'linear-gradient(to right, #3b4cc0, #5e7de7, #88aaf0, #b5cef3, #dde5ec, #f3d3c1, #f0a97c, #db6c51, #b40426)',
    Grayscale: 'linear-gradient(to right, #000000, #ffffff)'
};

interface GradientPreviewProps {
    gradient: string;
    startValue: number;
    endValue: number;
}

const formatValue = (value: number): string => {
    const absValue = Math.abs(value);
    let result: string;
    if (absValue >= 1e15) result = value.toExponential(3);
    else if (absValue >= 1e6) result = value.toExponential(3);
    else if (absValue < 0.001 && absValue !== 0) result = value.toExponential(3);
    else result = value.toPrecision(6).replace(/\.?0+$/, '');
    return result.replace('e+', 'e');
};

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

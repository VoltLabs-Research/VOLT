import { useState, useRef } from 'react';
import Container from '@/components/primitives/Container';
import useToast from '@/hooks/ui/use-toast';
import '@/features/canvas/components/atoms/GradientPreview/GradientPreview.css';

const GRADIENT_CSS: Record<string, string> = {
    Viridis: 'linear-gradient(to right, #440154, #482878, #3e4a89, #31688e, #26838f, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)',
    Plasma: 'linear-gradient(to right, #0d0887, #46039f, #7201a8, #9c179e, #bd3786, #d8576b, #ed7953, #fb9f3a, #fdca26, #f0f921)',
    BlueRed: 'linear-gradient(to right, #0000ff, #ffffff, #ff0000)',
    GrayScale: 'linear-gradient(to right, #000000, #ffffff)'
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
    const { showInfo } = useToast();

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

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const result = calculateValue(e);
        if (!result) return;
        
        const textArea = document.createElement('textarea');
        textArea.value = result.value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showInfo(`Value ${result.value} copied to clipboard`);
    };

    const gradientStyle = GRADIENT_CSS[gradient] || GRADIENT_CSS.Viridis;

    return (
        <Container className='gradient-preview-container'>
            <Container
                ref={barRef}
                className='gradient-preview-bar'
                style={{ background: gradientStyle }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            >
                {tooltipValue !== null && (
                    <Container
                        className='gradient-preview-tooltip'
                        style={{ left: tooltipX }}
                    >
                        {tooltipValue}
                    </Container>
                )}
            </Container>
            <Container className='gradient-preview-labels'>
                <span>{formatValue(startValue)}</span>
                <span>{formatValue(endValue)}</span>
            </Container>
        </Container>
    );
};

export default GradientPreview;

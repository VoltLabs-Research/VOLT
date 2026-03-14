import './WireframeBackground.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { useEffect, useRef } from 'react';

interface StrokeSettings {
    color: string;
    maxAlpha: number;
    minAlpha: number;
    lineWidth: number;
};

const toRgba = (color: string, alpha: number): string => {
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const normalizedHex = hex.length === 3
            ? hex.split('').map((value) => `${value}${value}`).join('')
            : hex;

        const red = parseInt(normalizedHex.slice(0, 2), 16);
        const green = parseInt(normalizedHex.slice(2, 4), 16);
        const blue = parseInt(normalizedHex.slice(4, 6), 16);

        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    const rgbMatch = color.match(/\d+/g);
    if (!rgbMatch || rgbMatch.length < 3) {
        return color;
    }

    const [red, green, blue] = rgbMatch;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const WireframeBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const prefersReducedMotion = usePrefersReducedMotion();

    useEffect(() => {
        const canvas = canvasRef.current;
        if(!canvas) return;

        const ctx = canvas.getContext('2d');
        if(!ctx) return;

        let animationFrameId: number;
        let time = 0;
        const lineCount = 40;
        const lineGap = 40;
        const amplitudeBase = 30;
        const amplitudeStep = 2;
        const waveSpeed = 0.015;
        const secondaryWave = 20;

        const resize = () => {
            canvas.width = window.innerWidth / 2;
            canvas.height = window.innerHeight;

             if (prefersReducedMotion) {
                draw();
            }
        };

        const getStrokeSettings = (): StrokeSettings => {
            const styles = window.getComputedStyle(document.documentElement);
            const theme = document.documentElement.getAttribute('data-theme');

            if (theme === 'light') {
                const color = styles.getPropertyValue('--accent-blue').trim()
                    || styles.getPropertyValue('--focus-ring').trim()
                    || styles.getPropertyValue('--color-text-primary').trim();

                return {
                    color,
                    maxAlpha: 0.52,
                    minAlpha: 0.12,
                    lineWidth: 1.25
                };
            }

            const color = styles.getPropertyValue('--color-contrast-high').trim()
                || styles.getPropertyValue('--color-text-primary').trim();

            return {
                color,
                maxAlpha: 0.3,
                minAlpha: 0,
                lineWidth: 1
            };
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const strokeSettings = getStrokeSettings();
            ctx.lineWidth = strokeSettings.lineWidth;

            for(let i = 0; i < lineCount; i++){
                ctx.beginPath();
                const alpha = strokeSettings.minAlpha + ((i / lineCount) * (strokeSettings.maxAlpha - strokeSettings.minAlpha));
                ctx.strokeStyle = toRgba(strokeSettings.color, alpha);

                for(let x = 0; x <= canvas.width; x += 10){
                    const yBase = (i * lineGap) - 100;
                    const amplitude = amplitudeBase + (i * amplitudeStep);
                    const frequency = 0.003;
                    const noise = Math.sin(x * frequency + time * waveSpeed + (i * 0.5));
                    const y = yBase + (noise * amplitude) + (Math.sin(x * 0.01) * secondaryWave);

                    if(x === 0){
                        ctx.moveTo(x, y);
                    }else{
                        ctx.lineTo(x, y);
                    }
                }

                ctx.stroke();
            }

            time++;
            if (!prefersReducedMotion) {
                animationFrameId = window.requestAnimationFrame(draw);
            }
        };

        window.addEventListener('resize', resize);

        const themeObserver = new MutationObserver(() => {
            if (prefersReducedMotion) {
                draw();
            }
        });

        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            themeObserver.disconnect();
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
            }
        };
    }, [prefersReducedMotion]);

    return (
        <canvas
            ref={canvasRef}
            className='wireframe-canvas p-absolute inset-0 w-max h-max'
            aria-hidden='true'
            role='presentation'
        />
    );
};

export default WireframeBackground;

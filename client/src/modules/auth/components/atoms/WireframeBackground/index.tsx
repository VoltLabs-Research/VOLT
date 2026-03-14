import './WireframeBackground.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { useEffect, useRef } from 'react';

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
        return `rgba(255, 255, 255, ${alpha})`;
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

        const resize = () => {
            canvas.width = window.innerWidth / 2;
            canvas.height = window.innerHeight;

             if (prefersReducedMotion) {
                draw();
            }
        };

        const lines = 40;
        const gap = 40;

        const getStrokeBase = () => {
            const styles = window.getComputedStyle(document.documentElement);
            const theme = document.documentElement.getAttribute('data-theme');

            if (theme === 'light') {
                return styles.getPropertyValue('--accent-blue').trim() || '#007aff';
            }

            return styles.getPropertyValue('--color-contrast-high').trim() || '#ffffff';
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;
            const strokeBase = getStrokeBase();

            for(let i = 0; i < lines; i++){
                ctx.beginPath();
                const alpha = (i / lines) * 0.3;
                ctx.strokeStyle = toRgba(strokeBase, alpha);

                for(let x = 0; x <= canvas.width; x += 10){
                    const yBase = (i * gap) - 100;
                    const amplitude = 30 + (i * 2);
                    const frequency = 0.003;
                    const speed = 0.015;
                    const noise = Math.sin(x * frequency + time * speed + (i * 0.5));
                    const y = yBase + (noise * amplitude) + (Math.sin(x * 0.01) * 20);

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

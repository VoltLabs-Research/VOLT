import { useEffect, useRef } from 'react';
import './WireframeBackground.css';

const WireframeBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

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
        };

        const lines = 40;
        const gap = 40;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;

            for(let i = 0; i < lines; i++){
                ctx.beginPath();
                const alpha = (i / lines) * 0.3;
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;

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
            animationFrameId = window.requestAnimationFrame(draw);
        };

        window.addEventListener('resize', resize);
        resize();
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            window.cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className='wireframe-canvas' />
    );
};

export default WireframeBackground;
import { useState, useCallback, useRef, useEffect } from 'react';

export type ResizeDirection = 'horizontal' | 'vertical';

interface UseResizableOptions {
    direction: ResizeDirection;
    initialSize: number;
    minSize?: number;
    maxSize?: number;
    growPositive?: boolean;
    onResize?: (size: number) => void;
}

interface UseResizableReturn {
    size: number;
    isDragging: boolean;
    handleProps: {
        onPointerDown: (e: React.PointerEvent) => void;
    };
}

const useResizable = ({
    direction,
    initialSize,
    minSize = 100,
    maxSize = Infinity,
    growPositive = true,
    onResize
}: UseResizableOptions): UseResizableReturn => {
    const [size, setSize] = useState(initialSize);
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef({ startPos: 0, startSize: 0 });

    const clamp = (value: number) => Math.max(minSize, Math.min(maxSize, value));

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const pos = direction === 'horizontal' ? e.clientX : e.clientY;
        dragState.current = { startPos: pos, startSize: size };
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [direction, size]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e: PointerEvent) => {
            const pos = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = pos - dragState.current.startPos;
            const sign = growPositive ? 1 : -1;
            const next = clamp(dragState.current.startSize + delta * sign);
            setSize(next);
            onResize?.(next);
        };

        const handleUp = () => setIsDragging(false);

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, direction, growPositive, minSize, maxSize, onResize]);

    return {
        size,
        isDragging,
        handleProps: { onPointerDown }
    };
};

export default useResizable;

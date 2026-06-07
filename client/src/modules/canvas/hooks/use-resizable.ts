import { useState, useCallback, useRef, useEffect } from 'react';

export enum ResizeDirection {
    Horizontal = 'horizontal',
    Vertical = 'vertical'
}

export type ResizeDirectionValue = ResizeDirection | 'horizontal' | 'vertical';

interface UseResizableOptions {
    direction: ResizeDirectionValue;
    initialSize: number;
    minSize?: number;
    maxSize?: number;
    growPositive?: boolean;
    storageKey?: string;
    onResize?: (size: number) => void;
}

interface UseResizableReturn {
    size: number;
    setSize: (size: number) => void;
    resetSize: () => void;
    isDragging: boolean;
    handleProps: {
        onPointerDown: (e: React.PointerEvent) => void;
        onKeyDown: (e: React.KeyboardEvent) => void;
        onDoubleClick: (e: React.MouseEvent) => void;
        valueMin: number;
        valueMax: number;
        valueNow: number;
    };
}

const readPersistedSize = (storageKey: string | undefined, fallback: number, min: number, max: number): number => {
    if (!storageKey) return fallback;
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw === null) return fallback;
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(min, Math.min(max, parsed));
    } catch {
        return fallback;
    }
};

const persistSize = (storageKey: string | undefined, size: number) => {
    if (!storageKey) return;
    try {
        window.localStorage.setItem(storageKey, String(Math.round(size)));
    } catch {
        // ignore quota/access errors
    }
};

const useResizable = ({
    direction,
    initialSize,
    minSize = 100,
    maxSize = Infinity,
    growPositive = true,
    storageKey,
    onResize
}: UseResizableOptions): UseResizableReturn => {
    const [size, setSize] = useState(() => readPersistedSize(storageKey, initialSize, minSize, maxSize));
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef({ startPos: 0, startSize: 0 });
    const isHorizontal = direction === ResizeDirection.Horizontal;

    const clamp = (value: number) => Math.max(minSize, Math.min(maxSize, value));

    const applySize = useCallback((nextSize: number) => {
        const resolvedSize = clamp(nextSize);
        setSize(resolvedSize);
        persistSize(storageKey, resolvedSize);
        onResize?.(resolvedSize);
    }, [onResize, minSize, maxSize, storageKey]);

    const resetSize = useCallback(() => {
        applySize(initialSize);
    }, [applySize, initialSize]);

    const onDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        resetSize();
    }, [resetSize]);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const pos = isHorizontal ? e.clientX : e.clientY;
        dragState.current = { startPos: pos, startSize: size };
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    }, [isHorizontal, size]);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        const step = e.shiftKey ? 48 : 16;
        const directionSign = growPositive ? 1 : -1;

        let nextSize = size;
        if (isHorizontal) {
            if (e.key === 'ArrowLeft') {
                nextSize = size - (step * directionSign);
            }

            if (e.key === 'ArrowRight') {
                nextSize = size + (step * directionSign);
            }
        }

        if (!isHorizontal) {
            if (e.key === 'ArrowUp') {
                nextSize = size - (step * directionSign);
            }

            if (e.key === 'ArrowDown') {
                nextSize = size + (step * directionSign);
            }
        }

        if (e.key === 'Home') {
            nextSize = minSize;
        }

        if (e.key === 'End') {
            nextSize = maxSize;
        }

        if (nextSize === size) {
            return;
        }

        e.preventDefault();
        applySize(nextSize);
    }, [applySize, growPositive, isHorizontal, maxSize, minSize, size]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e: PointerEvent) => {
            const pos = isHorizontal ? e.clientX : e.clientY;
            const delta = pos - dragState.current.startPos;
            const sign = growPositive ? 1 : -1;
            applySize(dragState.current.startSize + delta * sign);
        };

        const handleUp = () => setIsDragging(false);

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [applySize, growPositive, isDragging, isHorizontal]);

    return {
        size,
        setSize: applySize,
        resetSize,
        isDragging,
        handleProps: {
            onPointerDown,
            onKeyDown,
            onDoubleClick,
            valueMin: minSize,
            valueMax: maxSize,
            valueNow: size
        }
    };
};

export default useResizable;

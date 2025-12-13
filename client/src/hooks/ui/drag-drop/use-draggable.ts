import { useRef, useCallback, useLayoutEffect } from 'react';

export type Axis = 'x' | 'y' | 'both';

export interface DraggableOptions{
    enabled?: boolean;
    initial?: { x: number; y: number };
    axis?: Axis;
    handle?: string | HTMLElement | null;
    doubleClickToDrag?: boolean;
    bounds?: 'parent' | 'viewport' | (() => DOMRect);
    grid?: [number, number];
    scaleWhileDragging?: number;
    onDragStart?: (pos: { x: number; y: number }) => void;
    onDrag?: (pos: { x: number; y: number }) => void;
    onDragEnd?: (pos: { x: number; y: number }) => void;
}

export interface DraggableHandle{
    getElement: () => HTMLDivElement | null;
    resetPosition: () => void;
    setPosition: (x: number, y: number) => void;
    getPosition: () => { x: number; y: number };
}

const useDraggable = (options: DraggableOptions = {}) => {
    const {
        enabled = true,
        initial = { x: 0, y: 0 },
        axis = 'both',
        handle = null,
        doubleClickToDrag = true,
        bounds,
        grid,
        scaleWhileDragging = 0.95,
        onDragStart,
        onDrag,
        onDragEnd,
    } = options;

    const nodeRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0 });
    const posRef = useRef({ x: initial.x, y: initial.y });
    const pointerIdRef = useRef<number | null>(null);
    const lastScaleRef = useRef<number>(1);

    const originRef = useRef<{
        left: number;
        top: number;
        width: number;
        height: number
    } | null>(null);

    const applyTransform = useCallback((x: number, y: number, scale = 1) => {
        const el = nodeRef.current;
        if(!el) return;
        lastScaleRef.current = scale;
        el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }, []);

    const snapToGrid = useCallback((x: number, y: number) => {
        if(!grid) return { x, y };

        const [gx, gy] = grid;
        return {
            x: Math.round(x / gx) * gx,
            y: Math.round(y / gy) * gy,
        }
    }, [grid]);

    const clampToBounds = useCallback((x: number, y: number) => {
        const el = nodeRef.current;
        if(!el || !bounds || !originRef.current) return { x, y };

        let rect: DOMRect | { left: number; top: number; right: number; bottom: number; width: number; height: number } | null = null;

        if(bounds === 'parent'){
            rect = el.parentElement?.getBoundingClientRect() ?? null;
        }else if(bounds === 'viewport'){
            rect = {
                left: 0,
                top: 0,
                right: window.innerWidth,
                bottom: window.innerHeight,
                width: window.innerWidth,
                height: window.innerHeight,
            };
        }else{
            rect = bounds();
        }
        if(!rect) return { x, y };

        const origin = originRef.current;

        const minX = rect.left - origin.left;
        const maxX = rect.right - (origin.left + origin.width);
        const minY = rect.top - origin.top;
        const maxY = rect.bottom - (origin.top + origin.height);

        const clampedX = Math.min(Math.max(x, Math.min(minX, maxX)), Math.max(minX, maxX));
        const clampedY = Math.min(Math.max(y, Math.min(minY, maxY)), Math.max(minY, maxY));

        return { x: clampedX, y: clampedY };
    }, [bounds]);

    const measureOrigin = useCallback(() => {
        const el = nodeRef.current;
        if(!el) return;
        const prev = el.style.transform;
        el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) scale(1)`;
        const r = el.getBoundingClientRect();
        originRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
        el.style.transform = prev;
    }, []);

    const setPosition = useCallback((x: number, y: number) => {
        let nx = axis === 'y' ? posRef.current.x : x;
        let ny = axis === 'x' ? posRef.current.y : y;

        ({ x: nx, y: ny } = clampToBounds(nx, ny));
        ({ x: nx, y: ny } = snapToGrid(nx, ny));

        posRef.current = { x: nx, y: ny };
        applyTransform(nx, ny, lastScaleRef.current);
        onDrag?.(posRef.current);
    }, []);

    const resetPosition = useCallback(() => {
        posRef.current = { x: 0, y: 0 };
        applyTransform(0, 0, 1);
        measureOrigin();
    }, [applyTransform, measureOrigin]);

    const getPosition = useCallback(() => ({ ...posRef.current }), []);
    const getElement = useCallback(() => nodeRef.current, []);

    const startDragging = useCallback((clientX: number, clientY: number, pointerId?: number) => {
        if(!enabled) return;
        const el = nodeRef.current;
        if(!el) return;

        isDraggingRef.current = true;
        startRef.current = { x: clientX, y: clientY };

        applyTransform(posRef.current.x, posRef.current.y, scaleWhileDragging);
        onDragStart?.(posRef.current);

        if(pointerId !== undefined){
            pointerIdRef.current = pointerId;
            try{ el.setPointerCapture(pointerId); } catch {}
        }else{
            pointerIdRef.current = null;
        }

        document.body.style.cursor = 'grabbing';
    }, [enabled, applyTransform, onDragStart, scaleWhileDragging]);

    const stopDragging = useCallback(() => {
        if(!isDraggingRef.current) return;
        isDraggingRef.current = false;

        applyTransform(posRef.current.x, posRef.current.y, 1);
        onDragEnd?.(posRef.current);

        const el = nodeRef.current;
        if(el && pointerIdRef.current !== null){
            try{
                el.releasePointerCapture(pointerIdRef.current);
            }catch{}
        }

        pointerIdRef.current = null;
        document.body.style.cursor = '';
    }, [applyTransform, onDragEnd]);

    const handlePointerMove = useCallback((e: PointerEvent | MouseEvent) => {
        if(!isDraggingRef.current) return;

        const clientX = (e as PointerEvent).clientX ?? (e as MouseEvent).clientX;
        const clientY = (e as PointerEvent).clientY ?? (e as MouseEvent).clientY;

        const dx = clientX - startRef.current.x;
        const dy = clientY - startRef.current.y;

        let nx = posRef.current.x + (axis === 'y' ? 0 : dx);
        let ny = posRef.current.y + (axis === 'x' ? 0 : dy);

        ({ x: nx, y: ny } = clampToBounds(nx, ny));
        ({ x: nx, y: ny } = snapToGrid(nx, ny));

        posRef.current = { x: nx, y: ny };
        applyTransform(nx, ny, scaleWhileDragging);

        startRef.current = { x: clientX, y: clientY };
        onDrag?.(posRef.current);
    }, [axis, clampToBounds, snapToGrid, applyTransform, onDrag, scaleWhileDragging]);

    useLayoutEffect(() => {
        const el = nodeRef.current;
        if(!el) return;

        applyTransform(initial.x, initial.y, 1);
        posRef.current = { x: initial.x, y: initial.y };
        measureOrigin();

        const resolveHandleTarget = (): HTMLElement | null => {
            if(typeof handle === 'string'){
                return el.querySelector(handle) as HTMLElement | null;
            }

            if(handle instanceof HTMLElement) return handle;

            return null;
        };

        const handleTarget = resolveHandleTarget();

        const onPointerDown = (e: PointerEvent) => {
            if(!enabled || doubleClickToDrag) return;
            if(handle && handleTarget && e.target instanceof HTMLElement && !handleTarget.contains(e.target)) return;
            startDragging(e.clientX, e.clientY, e.pointerId);
        };

        const onDoubleClick = (e: MouseEvent) => {
            if(!enabled || !doubleClickToDrag) return;
            if(handle && handleTarget && e.target instanceof HTMLElement && !handleTarget.contains(e.target)) return;
            e.preventDefault();
            startDragging(e.clientX, e.clientY);
        };

        const onMove = (e: PointerEvent) => handlePointerMove(e);
        const onUp = () => stopDragging();

        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('dblclick', onDoubleClick);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);

        const onResize = () => {
            measureOrigin();
            const clamped = clampToBounds(posRef.current.x, posRef.current.y);
            if(clamped.x !== posRef.current.x || clamped.y !== posRef.current.y){
                posRef.current = clamped;
                applyTransform(clamped.x, clamped.y, 1);
            }
        };

        window.addEventListener('resize', onResize);

        return() => {
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('dblclick', onDoubleClick);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('resize', onResize);
        };
    }, [
        enabled,
        initial.x,
        initial.y,
        handle,
        doubleClickToDrag,
        startDragging,
        handlePointerMove,
        stopDragging,
        applyTransform,
        measureOrigin,
        clampToBounds,
    ]);

    return {
        nodeRef,
        getElement,
        resetPosition,
        setPosition,
        getPosition,
        startDragging,
        stopDragging,
    } as DraggableHandle & {
        nodeRef: typeof nodeRef;
        startDragging: (x: number, y: number, pointerId?: number) => void;
        stopDragging: () => void;
    };
}

export default useDraggable;

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';

interface Position{
    x: number;
    y: number;
}

interface UseDraggableProps {
    elementRef: RefObject<HTMLElement>;
    handleRef: RefObject<HTMLElement>;
    isEnabled: boolean;
}

export const useDraggable = ({ elementRef, handleRef, isEnabled }: UseDraggableProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

    const startMousePosRef = useRef<Position>({ x: 0, y: 0 });
    const startElementPosRef = useRef<Position>({ x: 0, y: 0 });

    const startDragging = useCallback((e: MouseEvent | TouchEvent) => {
        setIsDragging(true);

        // TODO: Duplicated Code!
        const hasTouch = 'touches' in e;
        const clientX = hasTouch ? e.touches[0].clientX : e.clientX;
        const clientY = hasTouch ? e.touches[0].clientY : e.clientY;

        startMousePosRef.current = {
            x: clientX,
            y: clientY
        };

        startElementPosRef.current = { ...position };

        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    }, [position]);

    useEffect(() => {
        const handle = handleRef.current;

        if(isEnabled && handle){
            handle.addEventListener('mousedown', startDragging);
            handle.addEventListener('touchstart', startDragging, { passive: true });

            return () => {
                handle.removeEventListener('mousedown', startDragging);
                handle.removeEventListener('touchstart', startDragging);
            };
        }
    }, [isEnabled, handleRef, startDragging]);

    useEffect(() => {
        const handleDragMove = (clientX: number, clientY: number) => {
            if(!isDragging || !elementRef.current) return;

            const deltaX = clientX - startMousePosRef.current.x;
            const deltaY = clientY - startMousePosRef.current.y;

            const newX = startElementPosRef.current.x + deltaX;
            const newY = startElementPosRef.current.y + deltaY;

            elementRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        };

        const handleMouseDrag = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        const handleTouchDrag = (e: TouchEvent) => {
            if(e.touches.length > 0){
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        };

        const stopDragging = () => {
            if(!isDragging) return;
            setIsDragging(false);

            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            if(elementRef.current){
                const transform = getComputedStyle(elementRef.current).transform;
                if(transform && transform !== 'none'){
                    const matrix = new DOMMatrix(transform);
                    setPosition({ x: matrix.m41, y: matrix.m42 });
                }
            }
        };

        if(isDragging){
            document.addEventListener('mousemove', handleMouseDrag);
            document.addEventListener('mouseup', stopDragging);
            document.addEventListener('touchmove', handleTouchDrag, { passive: true });
            document.addEventListener('touchend', stopDragging);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseDrag);
            document.removeEventListener('mouseup', stopDragging);
            document.removeEventListener('touchmove', handleTouchDrag);
            document.removeEventListener('touchend', stopDragging);
        };
    }, [isDragging, elementRef]);

    const resetPosition = useCallback(() => {
        setPosition({ x: 0, y: 0 });
    }, []);

    return { position, isDragging, resetPosition };
};
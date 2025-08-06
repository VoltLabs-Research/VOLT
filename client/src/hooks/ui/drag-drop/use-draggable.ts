/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

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

const useDraggable = ({ elementRef, handleRef, isEnabled }: UseDraggableProps) => {
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

export default useDraggable;
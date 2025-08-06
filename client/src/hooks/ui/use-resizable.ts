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

interface Size{
    width: number;
    height: number;
}

interface UseResizableProps {
    elementRef: RefObject<HTMLElement>;
    handleRef: RefObject<HTMLElement>;
    initialSize: Size;
    minSize?: Size;
    maxSize?: Size;
    isEnabled: boolean;
}

const useResizable = ({
    elementRef,
    handleRef,
    initialSize,
    minSize = { width: 50, height: 30 },
    maxSize = { width: 95, height: 90 },
    isEnabled,
}: UseResizableProps) => {
    const [isResizing, setIsResizing] = useState(false);
    const [size, setSize] = useState<Size>(initialSize);

    const startPosRef = useRef({ x: 0, y: 0 });
    const startSizeRef = useRef<Size>(initialSize);

    const startResizing = useCallback((e: MouseEvent | TouchEvent) => {
        e.stopPropagation();
        setIsResizing(true);

        const hasTouch = 'touches' in e;

        const clientX = hasTouch ? e.touches[0].clientX : e.clientX;
        const clientY = hasTouch ? e.touches[0].clientY : e.clientY;

        startPosRef.current = {
            x: clientX,
            y: clientY
        };

        if(elementRef.current){
            const rect = elementRef.current.getBoundingClientRect();
            startSizeRef.current = {
                width: (rect.width / window.innerWidth) * 100,
                height: (rect.height / window.innerHeight) * 100
            };
        }

        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }, [elementRef]);

    useEffect(() => {
        const handle = handleRef.current;

        if(isEnabled && handle){
            handle.addEventListener('mousedown', startResizing);
            handle.addEventListener('touchstart', startResizing, { passive: false });

            return () => {
                handle.removeEventListener('mousedown', startResizing);
                handle.removeEventListener('touchstart', startResizing);
            };
        }
    }, [isEnabled, handleRef, startResizing]);

    useEffect(() => {
        const handleResizeMove = (clientX: number, clientY: number) => {
            if(!isResizing || !elementRef.current) return;

            const deltaX = clientX - startPosRef.current.x;
            const widthChangeVw = (deltaX / window.innerWidth) * 100;
            const newWidth = Math.max(minSize.width, Math.min(maxSize.width, startSizeRef.current.width + widthChangeVw));

            const deltaY = startPosRef.current.y - clientY;
            const heightChangeVh = (deltaY / window.innerHeight) * 100;
            const newHeight = Math.max(minSize.height, Math.min(maxSize.height, startSizeRef.current.height + heightChangeVh));
            
            requestAnimationFrame(() => {
                if(elementRef.current){
                    elementRef.current.style.width = `${newWidth}vw`;
                    elementRef.current.style.height = `${newHeight}vh`;   
                }
            });
        };

        const handleMouseMove = (event: MouseEvent) => handleResizeMove(event.clientX, event.clientY);
        const handleTouchMove = (event: TouchEvent) => {
            if(event.touches.length > 0){
                event.preventDefault();
                handleResizeMove(event.touches[0].clientX, event.touches[0].clientY);
            }
        };

        const stopResizing = () => {
            if(!isResizing) return;
            setIsResizing(false);

            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            if(elementRef.current){
                const rect = elementRef.current.getBoundingClientRect();
                setSize({
                    width: (rect.width / window.innerWidth) * 100,
                    height: (rect.height / window.innerHeight) * 100,
                });
            }
        };

        if(isResizing){
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', stopResizing);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', stopResizing);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', stopResizing);
        };
    }, [isResizing, elementRef, minSize, maxSize]);

    const resetSize = useCallback(() => setSize(initialSize), [initialSize]);

    return { size, isResizing, resetSize };
};

export default useResizable;
/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { useState, useEffect, useCallback, type RefObject } from 'react';
import type { PositionStyles, ViewportDimensions } from '@/types/floating-container';

interface UsePositioningReturn {
    styles: PositionStyles;
    setInitialPosition: () => void;
    updatePosition: () => void;
}

const usePositioning = (
    triggerRef: RefObject<HTMLElement>,
    menuRef: RefObject<HTMLDivElement>,
    isVisible: boolean
): UsePositioningReturn => {
    const [styles, setStyles] = useState<PositionStyles>({
        position: 'fixed',
        top: '0px',
        left: '0px',
        // TODO: receive as param maybe?
        zIndex: 9999
    });

    const getViewportDimensions = useCallback((): ViewportDimensions => ({
        width: window.innerWidth,
        height: window.innerHeight
    }), []);

    const calculatePosition = useCallback((): Partial<PositionStyles> => {
        if(!triggerRef.current || !menuRef.current) return {};

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();
        const viewport = getViewportDimensions();

        let top = triggerRect.bottom + 20;
        let left = triggerRect.left;

        if(left + menuRect.width > viewport.width){
            left = viewport.width - menuRect.width - 10;
        }

        if(left < 10){
            left = 10;
        }

        if(top + menuRect.height > viewport.height){
            const topAlternative = triggerRect.top - menuRect.height - 20;
            
            if(topAlternative >= 10){
                top = topAlternative;
            }else{
                top = Math.max(10, (viewport.height - menuRect.width) / 2);
            }
        }

        if(top < 10){
            top = 10;
        }

        return {
            position: 'fixed' as const,
            top: `${top}px`,
            left: `${left}px`,
            zIndex: 9999,
        };
    }, [triggerRef, menuRef, getViewportDimensions]);

    const updatePosition = useCallback((): void => {
        if(isVisible && menuRef.current){
            const newStyles = calculatePosition();
            setStyles((prev) => ({ ...prev, ...newStyles, opacity: 1 }));
        }
    }, [isVisible, calculatePosition, menuRef]);

    const setInitialPosition = useCallback((): void => {
        if(!triggerRef.current) return;

        const { top, left, height } = triggerRef.current.getBoundingClientRect();
        setStyles({
            position: 'fixed',
            top: `${top + height + 20}px`,
            left: `${left}px`,
            zIndex: 9999,
            opacity: 0,
        });
    }, [triggerRef]);

    useEffect(() => {
        if(isVisible && menuRef.current){
            requestAnimationFrame(updatePosition);
        }
    }, [isVisible, updatePosition, menuRef]);

    useEffect(() => {
        if(!isVisible) return;

        const handleResize = (): void => updatePosition();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        if(!isVisible) return;

        const handleScroll = (): void => updatePosition();
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isVisible, updatePosition]);

    return { styles, setInitialPosition, updatePosition };
};

export default usePositioning;
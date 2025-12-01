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

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

interface UseFloatingMenuReturn {
    triggerRef: RefObject<HTMLDivElement>;
    menuRef: RefObject<HTMLDivElement>;
    isVisible: boolean;
    toggle: () => void;
    hide: () => void;
    show: () => void;
}

const useFloatingMenu = (): UseFloatingMenuReturn => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState<boolean>(false);

    const toggle = useCallback((): void => {
        setIsVisible((prev) => !prev);
    }, []);

    const hide = useCallback((): void => {
        setIsVisible(false);
    }, []);

    const show = useCallback((): void => {
        setIsVisible(true);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            const target = event.target as Node;
            if(
                menuRef.current &&
                !menuRef.current.contains(target) &&
                !triggerRef.current?.contains(target)
            ){
                hide();
            }
        };

        if(isVisible){
            document.addEventListener('mousedown', handleClickOutside as EventListener);
            
            return () => {
                document.removeEventListener('mousedown', handleClickOutside as EventListener);
            };
        }
    }, [isVisible, hide]);


    return {
        triggerRef,
        menuRef,
        isVisible,
        toggle,
        hide,
        show,
    };
};

export default useFloatingMenu;
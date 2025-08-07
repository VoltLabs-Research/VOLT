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

import { type MouseEvent, useCallback } from 'react';
import type { PositionStyles } from '@/types/floating-container';
import useFloatingMenu from '@/hooks/ui/positioning/use-floating-menu';
import usePositioning from '@/hooks/ui/positioning/use-positioning';

interface UseFloatingContainerReturn {
    triggerRef: React.RefObject<HTMLDivElement>;
    menuRef: React.RefObject<HTMLDivElement>;
    isVisible: boolean;
    styles: PositionStyles;
    handleToggle: (e: MouseEvent<HTMLDivElement>) => void;
    handleOptionClick: (originalOnClick: () => void, event: MouseEvent) => void;
    hide: () => void;
    show: () => void;
}

const useFloatingContainer = (): UseFloatingContainerReturn => {
    const {
        triggerRef,
        menuRef,
        isVisible,
        toggle,
        hide,
        show,
    } = useFloatingMenu();

    const { styles, setInitialPosition } = usePositioning(triggerRef, menuRef, isVisible);
    
    const handleToggle = useCallback((e: MouseEvent<HTMLDivElement>): void => {
        e.stopPropagation();

        if(!isVisible){
            setInitialPosition();
            show();
        }else{
            hide();
        }
    }, [isVisible, setInitialPosition, show, hide]);

    const handleOptionClick = useCallback((originalOnClick: () => void, event: MouseEvent): void => {
        event.stopPropagation();

        if(typeof originalOnClick === 'function'){
            originalOnClick();
        }

        hide();
    }, [hide]);

    return {
        triggerRef,
        menuRef,
        isVisible,
        styles,
        handleToggle,
        handleOptionClick,
        hide,
        show,
    };
};

export default useFloatingContainer;
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

import { useState } from 'react';

const useCardInteractions = (
    onSelect?: (itemId: string) => void, 
    onNavigate?: (itemId: string) => void, 
    isNavigationDisable?: boolean
): any => {
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const handleClick = (event: React.MouseEvent, itemId: string): void => {
        const target = event.target as HTMLElement;
        if(target.closest('.simulation-options-icon-container') || 
            target.closest('.simulation-caption-title') ||
            target.closest('.action-based-floating-container-element-wrapper') ||
            isNavigationDisable
        ){
            return;
        }

        if(event.ctrlKey || event.metaKey){
            event.preventDefault();
            onSelect?.(itemId);
        }else{
            onNavigate?.(itemId);
        }
    };

    const handleDelete = (
        itemId: string,
        deleteCallback: (id: string) => void,
        cleanup?: () => void
    ): void => {
        cleanup?.();
        setIsDeleting(true);
        setTimeout(() => {
            deleteCallback(itemId);
        }, 500);
    };

    return {
        isDeleting,
        handleClick,
        handleDelete
    }
};

export default useCardInteractions;
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

import { useState, useCallback } from 'react';

interface DragState {
    isDraggingOver: boolean;
    dragCounter: number;
}

const useDragState = () => {
    const [dragState, setDragState] = useState<DragState>({
        isDraggingOver: false,
        dragCounter: 0
    });

    const handleDragEnter = useCallback(() => {
        setDragState((prev) => ({
            isDraggingOver: true,
            dragCounter: prev.dragCounter + 1
        }));
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragState((prev) => {
            const newCounter = prev.dragCounter - 1;
            return {
                isDraggingOver: newCounter > 0,
                dragCounter: Math.max(0, newCounter)
            };
        });
    }, []);

    const resetDragState = useCallback(() => {
        setDragState({
            isDraggingOver: false,
            dragCounter: 0
        });
    }, []);

    return {
        isDraggingOver: dragState.isDraggingOver,
        handleDragEnter,
        handleDragLeave,
        resetDragState
    };
};

export default useDragState;
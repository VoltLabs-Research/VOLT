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
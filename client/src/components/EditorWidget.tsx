import React, { useRef, useCallback } from 'react';
import type { EditorWidgetProps } from '../types/index';

const EditorWidget: React.FC<EditorWidgetProps> = ({ 
    children, 
    className = ''
}) => {
    const widgetRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const currentTranslateRef = useRef({ x: 0, y: 0 });

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current || !widgetRef.current) return;

        const deltaX = e.clientX - startPosRef.current.x;
        const deltaY = e.clientY - startPosRef.current.y;

        const newX = currentTranslateRef.current.x + deltaX;
        const newY = currentTranslateRef.current.y + deltaY;

        widgetRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(0.95)`;
        
        startPosRef.current = { x: e.clientX, y: e.clientY };
        currentTranslateRef.current = { x: newX, y: newY };
    }, []);

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
        
        if (widgetRef.current) {
            const { x, y } = currentTranslateRef.current;
            widgetRef.current.style.transform = `translate(${x}px, ${y}px) scale(1)`;
        }
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
    }, [handleMouseMove]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        
        if(widgetRef.current){
            const { x, y } = currentTranslateRef.current;
            widgetRef.current.style.transform = `translate(${x}px, ${y}px) scale(0.95)`;
        }
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'grabbing';
    }, [handleMouseMove, handleMouseUp]);

    return (
        <div 
            ref={widgetRef}
            className={`editor-floating-container ${className}`}
            onDoubleClick={handleDoubleClick}
            style={{ 
                willChange: 'transform',
                transition: 'transform 0.1s ease-out'
            }}
        >
            {children}
        </div>
    );
};

export default EditorWidget;
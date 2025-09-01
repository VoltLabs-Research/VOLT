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

import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import useEditorUIStore from '@/stores/ui/editor';
import './EditorWidget.css';

interface EditorWidgetProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    draggable?: boolean
}

export interface EditorWidgetRef {
    getElement: () => HTMLDivElement | null;
    resetPosition: () => void;
    setPosition: (x: number, y: number) => void;
    getPosition: () => { x: number; y: number };
}

const EditorWidget = forwardRef<EditorWidgetRef, EditorWidgetProps>(({ 
    children, 
    className = '',
    style = {},
    draggable = true
}, ref) => {
    const widgetRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const currentTranslateRef = useRef({ x: 0, y: 0 });
    const isSceneInteracting = useEditorUIStore((state) => state.isSceneInteracting);

    useImperativeHandle(ref, () => ({
        getElement: () => widgetRef.current,
        resetPosition: () => {
            currentTranslateRef.current = { x: 0, y: 0 };
            if (widgetRef.current) {
                widgetRef.current.style.transform = 'translate(0px, 0px) scale(1)';
            }
        },
        setPosition: (x: number, y: number) => {
            currentTranslateRef.current = { x, y };
            if (widgetRef.current) {
                widgetRef.current.style.transform = `translate(${x}px, ${y}px) scale(1)`;
            }
        },
        getPosition: () => ({ ...currentTranslateRef.current })
    }), []);

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
        if(!draggable) return;
        isDraggingRef.current = true;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        
        if (widgetRef.current) {
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
            className={`editor-floating-container ${isSceneInteracting ? 'dimmed' : ''} ${className}`}
            onDoubleClick={handleDoubleClick}
            style={{ 
                ...style
            }}
        >
            {children}
        </div>
    );
});

EditorWidget.displayName = 'EditorWidget';

export default EditorWidget;
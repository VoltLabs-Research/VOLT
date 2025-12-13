/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface CursorPositionedContainerProps {
    isVisible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    offsetX?: number;
    offsetY?: number;
    zIndex?: number;
    preventOverflow?: boolean;
    fallbackPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const CursorPositionedContainer: React.FC<CursorPositionedContainerProps> = ({
    isVisible,
    onClose,
    children,
    className = '',
    offsetX = 10,
    offsetY = 10,
    zIndex = 9999,
    preventOverflow = true,
    fallbackPosition = 'center'
}) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate position with overflow prevention
    const calculatePosition = (cursorX: number, cursorY: number) => {
        let x = cursorX + offsetX;
        let y = cursorY + offsetY;

        if(preventOverflow && containerRef.current){
            const rect = containerRef.current.getBoundingClientRect();
            const padding = 16;

            // Adjust horizontal position
            if(x + rect.width > window.innerWidth - padding){
                x = window.innerWidth - rect.width - padding;
            }
            if(x < padding){
                x = padding;
            }

            // Adjust vertical position
            if(y + rect.height > window.innerHeight - padding){
                y = window.innerHeight - rect.height - padding;
            }
            if(y < padding){
                y = padding;
            }
        }

        return { x, y };
    };

    // Get fallback position based on preference
    const getFallbackPosition = () => {
        const modalWidth = containerRef.current?.offsetWidth || 320;
        const modalHeight = containerRef.current?.offsetHeight || 400;

        switch(fallbackPosition){
            case 'top-left':
                return { x: 16, y: 16 };
            case 'top-right':
                return { x: window.innerWidth - modalWidth - 16, y: 16 };
            case 'bottom-left':
                return { x: 16, y: window.innerHeight - modalHeight - 16 };
            case 'bottom-right':
                return { x: window.innerWidth - modalWidth - 16, y: window.innerHeight - modalHeight - 16 };
            case 'center':
            default:
                return {
                    x: (window.innerWidth - modalWidth) / 2,
                    y: (window.innerHeight - modalHeight) / 2
                };
        }
    };

    // Update position when container becomes visible
    useEffect(() => {
        if(isVisible){
            const lastMouseEvent = (window as any).lastMouseEvent;
            if(lastMouseEvent){
                const newPosition = calculatePosition(lastMouseEvent.clientX, lastMouseEvent.clientY);
                setPosition(newPosition);
            }else{
                setPosition(getFallbackPosition());
            }
        }
    }, [isVisible, offsetX, offsetY, preventOverflow, fallbackPosition]);

    // Handle clicks outside the container
    useEffect(() => {
        if(!isVisible) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;

            // Don't close if clicking inside the container
            if(containerRef.current && containerRef.current.contains(target)) {
                return;
            }

            // Don't close if clicking on other modals or dropdowns(but allow closing on regular page elements)
            const isOtherModal = target.closest('[role="dialog"], [role="menu"], [role="listbox"], .modal, .dropdown, .popover');
            if(isOtherModal && !containerRef.current?.contains(isOtherModal)) {
                return;
            }

            // Close the container
            onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        return() => document.removeEventListener('mousedown', handleClickOutside);
    }, [isVisible, onClose]);

    // Handle escape key
    useEffect(() => {
        if(!isVisible) return;

        const handleEscape = (e: KeyboardEvent) => {
            if(e.key === 'Escape'){
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return() => document.removeEventListener('keydown', handleEscape);
    }, [isVisible, onClose]);

    if(!isVisible) return null;

    const styles: React.CSSProperties = {
        position: 'fixed',
        top: `${position.y}px`,
        left: `${position.x}px`,
        zIndex,
    };

    return createPortal(
        <div
            ref={containerRef}
            className={className}
            style={styles}
        >
            {children}
        </div>,
        document.body
    );
};

export default CursorPositionedContainer;

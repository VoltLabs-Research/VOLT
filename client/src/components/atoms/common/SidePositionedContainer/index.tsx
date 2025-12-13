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

interface SidePositionedContainerProps {
    isVisible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    referenceElement?: HTMLElement | null;
    preferredSide?: 'left' | 'right' | 'auto';
    offset?: number;
    zIndex?: number;
    maxWidth?: number;
    maxHeight?: number;
}

const SidePositionedContainer: React.FC<SidePositionedContainerProps> = ({
    isVisible,
    onClose,
    children,
    className = '',
    referenceElement,
    preferredSide = 'auto',
    offset = 10,
    zIndex = 10000,
    maxWidth = 400,
    maxHeight = 600
}) => {
    const [position, setPosition] = useState({ x: 0, y: 0, side: 'right' as 'left' | 'right' });
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate position relative to reference element
    const calculatePosition = () => {
        if(!referenceElement || !containerRef.current) return;

        const referenceRect = referenceElement.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const padding = 16;

        let x: number;
        let y = referenceRect.top;
        let side: 'left' | 'right' = 'right';

        // Determine which side to show based on available space
        if(preferredSide === 'auto'){
            const spaceRight = window.innerWidth - referenceRect.right - padding;
            const spaceLeft = referenceRect.left - padding;

            if(spaceRight >= maxWidth || spaceRight > spaceLeft){
                // Show on the right
                x = referenceRect.right + offset;
                side = 'right';
            }else{
                // Show on the left
                x = referenceRect.left - maxWidth - offset;
                side = 'left';
            }
        }else if(preferredSide === 'right'){
            x = referenceRect.right + offset;
            side = 'right';
        }else{
            x = referenceRect.left - maxWidth - offset;
            side = 'left';
        }

        // Adjust horizontal position to prevent overflow
        if(x < padding){
            x = padding;
        }
        if(x + maxWidth > window.innerWidth - padding){
            x = window.innerWidth - maxWidth - padding;
        }

        // Adjust vertical position to prevent overflow
        if(y < padding){
            y = padding;
        }
        if(y + maxHeight > window.innerHeight - padding){
            y = window.innerHeight - maxHeight - padding;
        }

        setPosition({ x, y, side });
    };

    // Update position when container becomes visible or reference changes
    useEffect(() => {
        if(isVisible && referenceElement){
            // Small delay to ensure container is rendered
            const timer = setTimeout(calculatePosition, 10);
            return() => clearTimeout(timer);
        }
    }, [isVisible, referenceElement, preferredSide, offset, maxWidth, maxHeight]);

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
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
        width: 'auto',
        height: 'auto',
    };

    return createPortal(
        <div
            ref={containerRef}
            className={`side-positioned-container ${className}`}
            style={styles}
            data-side={position.side}
        >
            {children}
        </div>,
        document.body
    );
};

export default SidePositionedContainer;

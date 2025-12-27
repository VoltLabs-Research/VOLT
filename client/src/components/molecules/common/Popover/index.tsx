import React, { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Popover.css';

interface PopoverProps {
    id: string;
    trigger: ReactNode;
    children: ReactNode;
    className?: string;
    noPadding?: boolean;
    triggerAction?: 'click' | 'contextmenu';
}

const Popover = ({
    id,
    trigger,
    children,
    className = '',
    noPadding = false,
    triggerAction = 'click'
}: PopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [style, setStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLElement | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const cursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const calculatePosition = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 16;

        requestAnimationFrame(() => {
            if (!popoverRef.current) return;

            const rect = popoverRef.current.getBoundingClientRect();
            const { x, y } = cursorPosRef.current;

            let left = x;
            let top = y;

            // Adjust if overflows right
            if (left + rect.width > vw - padding) {
                left = x - rect.width;
            }

            // Adjust if overflows bottom
            if (top + rect.height > vh - padding) {
                top = y - rect.height;
            }

            // Ensure not negative
            if (left < padding) left = padding;
            if (top < padding) top = padding;

            setStyle({
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                margin: 0,
                maxWidth: `calc(100vw - ${padding * 2}px)`,
                zIndex: 9999
            });
        });
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggle = useCallback((e: React.MouseEvent) => {
        // Always store cursor position
        cursorPosRef.current = { x: e.clientX, y: e.clientY };

        setIsOpen((prev) => !prev);
    }, []);

    // Position the popover when it opens
    useEffect(() => {
        if (isOpen) {
            calculatePosition();
        }
    }, [isOpen, calculatePosition]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            if (popoverRef.current?.contains(target)) {
                return;
            }

            if (triggerRef.current?.contains(target)) {
                return;
            }

            close();
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                close();
            }
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, close]);

    const handleTriggerClick = useCallback((e: React.MouseEvent) => {
        if (triggerAction !== 'click') return;
        e.stopPropagation();
        toggle(e);
    }, [triggerAction, toggle]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        if (triggerAction !== 'contextmenu') return;
        e.preventDefault();
        e.stopPropagation();
        toggle(e);
    }, [triggerAction, toggle]);

    const triggerElement = trigger && React.isValidElement(trigger)
        ? React.cloneElement(trigger as React.ReactElement<any>, {
            ref: (el: HTMLElement) => {
                triggerRef.current = el;
            },
            onClick: (e: React.MouseEvent) => {
                const originalOnClick = (trigger as React.ReactElement<any>).props.onClick;
                originalOnClick?.(e);
                handleTriggerClick(e);
            },
            onContextMenu: (e: React.MouseEvent) => {
                const originalOnContextMenu = (trigger as React.ReactElement<any>).props.onContextMenu;
                originalOnContextMenu?.(e);
                handleContextMenu(e);
            },
            'data-popover-trigger': id
        })
        : null;

    const popoverContent = isOpen ? createPortal(
        <div
            ref={popoverRef}
            id={id}
            className={`volt-popover d-flex column glass-bg ${noPadding ? '' : 'p-05'} ${className} color-primary`}
            style={style}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body
    ) : null;

    return (
        <>
            {triggerElement}
            {popoverContent}
        </>
    );
};

export default Popover;

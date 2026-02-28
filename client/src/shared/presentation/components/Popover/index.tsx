import React, { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Container from '@/shared/presentation/components/Container';
import './Popover.css';

interface PopoverProps {
    id: string;
    trigger: ReactNode;
    children: ReactNode | ((close: () => void) => ReactNode);
    className?: string;
    noPadding?: boolean;
    triggerAction?: 'click' | 'contextmenu';
    onOpenChange?: (isOpen: boolean) => void;
};

const Popover: React.FC<PopoverProps> = ({
    id,
    trigger,
    children,
    className = '',
    noPadding = false,
    triggerAction = 'click',
    onOpenChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [style, setStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLDivElement | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const cursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const calculatePosition = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 16;

        requestAnimationFrame(() => {
            if(!popoverRef.current) return;

            const rect = popoverRef.current.getBoundingClientRect();
            const { x, y } = cursorPosRef.current;

            let left = x;
            let top = y;

            if(left + rect.width > vw - padding){
                left = x - rect.width;
            }

            if(top + rect.height > vh - padding){
                top = y - rect.height;
            }

            if(left < padding) left = padding;
            if(top < padding) top = padding;

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
        cursorPosRef.current = { x: e.clientX, y: e.clientY };
        setIsOpen((prev) => !prev);
    }, []);

    useEffect(() => {
        if(isOpen){
            calculatePosition();
        }
        onOpenChange?.(isOpen);
    }, [isOpen, calculatePosition, onOpenChange]);

    useEffect(() => {
        if(!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            if(popoverRef.current?.contains(target)){
                return;
            }

            if(triggerRef.current?.contains(target)){
                return;
            }

            close();
        };

        const handleEscape = (e: KeyboardEvent) => {
            if(e.key === 'Escape'){
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
        if(triggerAction !== 'click') return;
        e.stopPropagation();
        toggle(e);
    }, [triggerAction, toggle]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        if(triggerAction !== 'contextmenu') return;
        e.preventDefault();
        e.stopPropagation();
        toggle(e);
    }, [triggerAction, toggle]);

    const triggerElement = trigger && React.isValidElement(trigger)
        ? (
            <Container
                ref={triggerRef}
                data-popover-trigger={id}
                style={{ display: 'contents' }}
                onClick={handleTriggerClick}
                onContextMenu={handleContextMenu}
            >
                {trigger}
            </Container>
        )
        : null;

    const renderChildren = () => {
        if(typeof children === 'function'){
            return children(close);
        }
        return children;
    };

    const popoverContent = isOpen ? createPortal(
        <Container
            ref={popoverRef}
            id={id}
            className={`popover radius-lg d-flex column glass-bg ${noPadding ? '' : 'p-05'} ${className} color-primary`}
            style={style}
            onClick={(e) => e.stopPropagation()}
        >
            {renderChildren()}
        </Container>,
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

import React, { type ReactNode } from 'react';
import './Popover.css';

declare global {
    namespace React {
        interface HTMLAttributes<T> {
            popover?: '' | 'auto' | 'manual' | 'hint';
            popovertarget?: string;
            popovertargetaction?: 'toggle' | 'show' | 'hide';
            commandfor?: string;
            command?: string;
        }
    }
}

interface PopoverProps {
    id: string;
    trigger: ReactNode;
    children: ReactNode;
    type?: 'auto' | 'manual';
    className?: string;
    noPadding?: boolean;
}

const Popover = ({
    id,
    trigger,
    children,
    type = 'auto',
    className = '',
    noPadding = false
}: PopoverProps) => {



    // Store click position for positioning
    const clickPosRef = React.useRef<{ x: number; y: number } | null>(null);

    // Capture click position when trigger is clicked
    React.useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const triggerElement = target.closest(`[commandfor="${id}"]`);
            if (triggerElement) {
                clickPosRef.current = { x: e.clientX, y: e.clientY };
            }
        };
        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, [id]);

    // Position the popover near the click position when it opens
    React.useEffect(() => {
        const popover = document.getElementById(id);
        if (!popover) return;

        const positionPopover = () => {
            if (!clickPosRef.current) return;

            const popoverRect = popover.getBoundingClientRect();
            const { x, y } = clickPosRef.current;

            // Position below and to the right of click
            let top = y + 8;
            let left = x;

            // Adjust if popover would go off-screen (right)
            if (left + popoverRect.width > window.innerWidth) {
                left = window.innerWidth - popoverRect.width - 16;
            }

            // Adjust if popover would go off-screen (bottom)
            if (top + popoverRect.height > window.innerHeight) {
                // Show above the click instead
                top = y - popoverRect.height - 8;
            }

            // Ensure left doesn't go negative
            if (left < 8) left = 8;

            popover.style.top = `${top + 16}px`;
            popover.style.left = `${left}px`;
            popover.style.margin = '0';
        };

        // Watch for toggle events to handle positioning
        const handleToggle = (e: any) => {
            if (e.newState === 'open') {
                // Use setTimeout to ensure popover is rendered
                setTimeout(positionPopover, 0);
            }
        };

        // Position when popover opens
        popover.addEventListener('toggle', handleToggle);

        return () => {
            popover.removeEventListener('toggle', handleToggle);
        };
    }, [id]);

    return (
        <>
            {trigger && React.isValidElement(trigger) ? (
                React.cloneElement(trigger as React.ReactElement<any>, {
                    commandfor: id,
                    command: "toggle-popover",
                    type: "button"
                })
            ) : null}

            <div
                id={id}
                popover={type}
                className={`volt-popover d-flex column glass-bg p-fixed ${noPadding ? '' : 'p-05'} ${className} color-primary`}
            >
                {children}
            </div>
        </>
    );
};

export default Popover;

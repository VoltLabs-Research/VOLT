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



    // Position the popover near the trigger when it opens
    React.useEffect(() => {
        const popover = document.getElementById(id);
        if (!popover) return;

        const positionPopover = () => {
            // Find trigger by commandfor attribute also
            const triggerElement = document.querySelector(`[popovertarget="${id}"], [commandfor="${id}"]`);
            if (!triggerElement || !popover) return;

            const triggerRect = triggerElement.getBoundingClientRect();
            const popoverRect = popover.getBoundingClientRect();

            // Position below the trigger by default
            let top = triggerRect.bottom + 8; // 8px gap
            let left = triggerRect.left;

            // Adjust if popover would go off-screen
            if (left + popoverRect.width > window.innerWidth) {
                left = window.innerWidth - popoverRect.width - 16;
            }

            if (top + popoverRect.height > window.innerHeight) {
                // Show above instead
                top = triggerRect.top - popoverRect.height - 8;
            }

            popover.style.top = `${top}px`;
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

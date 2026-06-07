import Button from '../Button';
import { X } from 'lucide-react';
import { forwardRef } from 'react';

interface CloseButtonProps {
    onClick?: () => void;
    /** For dialog command API - use with commandfor */
    command?: 'close';
    /** Dialog ID for command API */
    commandfor?: string;
    'aria-label'?: string;
};

const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(({
    onClick,
    command,
    commandfor,
    'aria-label': ariaLabel = 'Close'
}, ref) => {
    return (
        <Button
            ref={ref}
            variant='ghost'
            intent='neutral'
            iconOnly
            size='sm'
            onClick={onClick}
            command={command}
            commandfor={commandfor}
            aria-label={ariaLabel}
        >
            <X size={20} />
        </Button>
    );
});

CloseButton.displayName = 'CloseButton';

export default CloseButton;

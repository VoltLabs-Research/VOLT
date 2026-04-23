import Button from '../Button';
import { X } from 'lucide-react';

interface CloseButtonProps {
    onClick?: () => void;
    /** For dialog command API - use with commandfor */
    command?: 'close';
    /** Dialog ID for command API */
    commandfor?: string;
    'aria-label'?: string;
};

const CloseButton = ({
    onClick,
    command,
    commandfor,
    'aria-label': ariaLabel = 'Close'
}: CloseButtonProps) => {
    return (
        <Button
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
};

export default CloseButton;

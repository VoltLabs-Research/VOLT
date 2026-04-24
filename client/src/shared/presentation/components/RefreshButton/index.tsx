import Button from '@/shared/presentation/primitives/Button';
import Loader from '@/shared/presentation/primitives/Loader';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
    onClick?: () => void;
    isLoading?: boolean;
    label?: string;
    tooltipContent?: string;
    size?: 'sm' | 'md';
    variant?: 'ghost' | 'outline' | 'solid';
    intent?: 'neutral' | 'brand' | 'white';
};

const RefreshButton = ({
    onClick,
    isLoading = false,
    label,
    tooltipContent = 'Refresh',
    size = 'sm',
    variant = 'ghost',
    intent = 'neutral'
}: RefreshButtonProps) => {
    const icon = isLoading
        ? <Loader scale={0.6} isFixed={false} />
        : <RefreshCw size={size === 'sm' ? 14 : 16} />;

    if(label){
        return (
            <Button
                variant={variant}
                intent={intent}
                size={size}
                leftIcon={icon}
                onClick={onClick}
                disabled={isLoading}
                aria-busy={isLoading}
            >
                {label}
            </Button>
        );
    }

    return (
        <Tooltip content={tooltipContent} placement='bottom'>
            <Button
                variant={variant}
                intent={intent}
                size={size}
                iconOnly
                aria-label={tooltipContent}
                onClick={onClick}
                disabled={isLoading}
                title={tooltipContent}
                aria-busy={isLoading}
            >
                {icon}
            </Button>
        </Tooltip>
    );
};

export default RefreshButton;

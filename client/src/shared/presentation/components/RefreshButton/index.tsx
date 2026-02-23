import { RefreshCw } from 'lucide-react';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Loader from '@/shared/presentation/components/Loader';

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
                onClick={onClick}
                disabled={isLoading}
            >
                {icon}
            </Button>
        </Tooltip>
    );
};

export default RefreshButton;

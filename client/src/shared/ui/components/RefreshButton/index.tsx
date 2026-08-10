import { Button, Spinner, Tooltip } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import type { ButtonVariants } from '@heroui/react';

type RefreshButtonVariant = 'ghost' | 'outline' | 'solid';
type RefreshButtonIntent = 'neutral' | 'brand' | 'white';

interface RefreshButtonProps {
    onClick?: () => void;
    isLoading?: boolean;
    label?: string;
    tooltipContent?: string;
    size?: 'sm' | 'md';
    variant?: RefreshButtonVariant;
    intent?: RefreshButtonIntent;
};

/**
 * bravais crossed `variant` with `intent`; HeroUI has a single `variant`. The pairs
 * are resolved by what `.button.intent-X.variant-Y` actually painted, not by name:
 *
 *   solid + neutral  filled `--color-surface-2`, a neutral fill  → secondary
 *   solid + brand    filled with the accent                     → primary
 *   solid + white    filled `--color-contrast-high`, inverted ink
 *                    — which under VOLT's monochrome accent IS `primary`
 *   outline + *      transparent, `--color-border` edge          → outline
 *   ghost + *        transparent, muted ink brightening on hover → ghost
 *
 * The two prop names stay because call sites pass them; only the resolution moves
 * in here.
 */
const BUTTON_VARIANTS: Record<`${RefreshButtonVariant}-${RefreshButtonIntent}`, NonNullable<ButtonVariants['variant']>> = {
    'ghost-neutral': 'ghost',
    'ghost-brand': 'ghost',
    'ghost-white': 'ghost',
    'outline-neutral': 'outline',
    'outline-brand': 'outline',
    'outline-white': 'outline',
    'solid-neutral': 'secondary',
    'solid-brand': 'primary',
    'solid-white': 'primary'
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
    const buttonVariant = BUTTON_VARIANTS[`${variant}-${intent}`];
    const icon = isLoading
        ? <Spinner size='sm' color='current' />
        : <RefreshCw size={size === 'sm' ? 14 : 16} />;

    if(label){
        return (
            <Button
                variant={buttonVariant}
                size={size}
                onPress={onClick}
                isPending={isLoading}
            >
                {icon}
                {label}
            </Button>
        );
    }

    return (
        <Tooltip>
            <Button
                variant={buttonVariant}
                size={size}
                isIconOnly
                aria-label={tooltipContent}
                onPress={onClick}
                isPending={isLoading}
            >
                {icon}
            </Button>
            <Tooltip.Content placement='bottom'>{tooltipContent}</Tooltip.Content>
        </Tooltip>
    );
};

export default RefreshButton;

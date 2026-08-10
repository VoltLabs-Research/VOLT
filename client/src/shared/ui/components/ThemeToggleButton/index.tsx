import { Button, Tooltip } from '@heroui/react';
import { Theme, useTheme } from '@/shared/ui/hooks/use-theme';
import { Moon, Sun } from 'lucide-react';
import type { ButtonVariants } from '@heroui/react';

interface ThemeToggleButtonProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'ghost';
};

/**
 * bravais's `IconButton` had two variants that painted identically —
 * `--ghost` only restated the transparent background and the hover fill the base
 * rule already declared — so both resolve to HeroUI's `ghost`. The prop stays in
 * the public shape because callers pass it; dropping it would be a rename.
 */
const BUTTON_VARIANTS: Record<'default' | 'ghost', NonNullable<ButtonVariants['variant']>> = {
    default: 'ghost',
    ghost: 'ghost'
};

const ThemeToggleButton = ({
    className = '',
    size = 'sm',
    variant = 'ghost'
}: ThemeToggleButtonProps) => {
    const { theme: effectiveTheme, setTheme } = useTheme();
    const isDarkTheme = effectiveTheme === Theme.Dark;
    const nextTheme = isDarkTheme ? Theme.Light : Theme.Dark;
    const label = isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <Tooltip>
            <Button
                className={className}
                size={size}
                variant={BUTTON_VARIANTS[variant]}
                isIconOnly
                aria-label={label}
                onPress={() => setTheme(nextTheme)}
            >
                {isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Tooltip.Content placement='bottom'>{label}</Tooltip.Content>
        </Tooltip>
    );
};

export default ThemeToggleButton;

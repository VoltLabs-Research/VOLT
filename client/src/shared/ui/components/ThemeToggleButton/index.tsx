import { Button, Tooltip } from '@heroui/react';
import { Theme, useTheme } from '@/shared/ui/hooks/use-theme';
import { Moon, Sun } from 'lucide-react';
import type { ButtonVariants } from '@heroui/react';

interface ThemeToggleButtonProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'ghost';
};

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

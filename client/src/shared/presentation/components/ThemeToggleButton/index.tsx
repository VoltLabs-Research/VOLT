import IconButton from '@/shared/presentation/components/IconButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { Theme, useTheme } from '@/shared/presentation/hooks/use-theme';
import { Moon, Sun } from 'lucide-react';

interface ThemeToggleButtonProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'ghost';
};

const ThemeToggleButton = ({
    className = '',
    size = 'sm',
    variant = 'ghost'
}: ThemeToggleButtonProps) => {
    const { theme, setTheme } = useTheme();
    const isDarkTheme = theme === Theme.Dark;
    const nextTheme = isDarkTheme ? Theme.Light : Theme.Dark;
    const label = isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <Tooltip content={label} placement='bottom'>
            <IconButton
                className={className}
                size={size}
                variant={variant}
                aria-label={label}
                title={label}
                onClick={() => setTheme(nextTheme)}
            >
                {isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
        </Tooltip>
    );
};

export default ThemeToggleButton;

import { Button, Tooltip } from '@heroui/react';
import { Theme, useTheme } from '@/shared/ui/hooks/use-theme';
import { Moon, Sun } from 'lucide-react';

const ThemeToggleButton = () => {
    const { theme: effectiveTheme, setTheme } = useTheme();
    const isDarkTheme = effectiveTheme === Theme.Dark;
    const nextTheme = isDarkTheme ? Theme.Light : Theme.Dark;
    const label = isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <Tooltip>
            <Button
                size='sm'
                variant='ghost'
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

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
                variant='ghost'
                isIconOnly
                className='rounded-lg text-muted hover:bg-foreground/6 hover:text-foreground'
                aria-label={label}
                onPress={() => setTheme(nextTheme)}
            >
                {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Tooltip.Content placement='bottom'>{label}</Tooltip.Content>
        </Tooltip>
    );
};

export default ThemeToggleButton;

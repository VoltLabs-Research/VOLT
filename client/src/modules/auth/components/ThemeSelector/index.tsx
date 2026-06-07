import './ThemeSelector.css';
import ThemeCard from '@/modules/auth/components/ThemeCard';
import { Box } from '@voltstack/bravais';
import { Theme, useTheme } from '@/shared/presentation/hooks/use-theme';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

interface ThemeOption {
    theme: Theme;
    label: string;
    previewClassName: string;
    icon: ReactNode;
}

const ThemeSelector = () => {
    const { preference, setTheme } = useTheme();
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const options: ThemeOption[] = [
        {
            theme: Theme.System,
            label: 'System',
            previewClassName: 'system-preview',
            icon: <Monitor size={32} />
        },
        {
            theme: Theme.Light,
            label: 'Light',
            previewClassName: 'light-preview',
            icon: <Sun size={32} />
        },
        {
            theme: Theme.Dark,
            label: 'Dark',
            previewClassName: 'dark-preview',
            icon: <Moon size={32} />
        }
    ];

    const selectedIndex = options.findIndex((option) => option.theme === preference);

    const focusOption = (index: number): void => {
        optionRefs.current[index]?.focus();
    };

    const selectOption = (index: number): void => {
        setTheme(options[index].theme);
        focusOption(index);
    };

    const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = (index + 1) % options.length;
            selectOption(nextIndex);
            return;
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            const nextIndex = (index - 1 + options.length) % options.length;
            selectOption(nextIndex);
            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            selectOption(0);
            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            selectOption(options.length - 1);
        }
    };

    return (
        <Box gap='1' className='theme-selector-grid' role='radiogroup' aria-label='Theme selector'>
            {options.map((option, index) => (
                <ThemeCard
                    key={option.theme}
                    ref={(element) => {
                        optionRefs.current[index] = element;
                    }}
                    theme={option.theme}
                    label={option.label}
                    icon={option.icon}
                    previewClassName={option.previewClassName}
                    isSelected={preference === option.theme}
                    onClick={() => setTheme(option.theme)}
                    onKeyDown={handleKeyDown(index)}
                    tabIndex={index === selectedIndex ? 0 : -1}
                />
            ))}
        </Box>
    );
};

export default ThemeSelector;

import './ThemeSelector.css';
import ThemeCard from '@/modules/auth/components/molecules/ThemeCard';
import Container from '@/shared/presentation/components/Container';
import { Theme, useTheme } from '@/shared/presentation/hooks/use-theme';
import { Sun, Moon } from 'lucide-react';
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ReactNode } from 'react';

interface ThemeOption {
    theme: Theme;
    label: string;
    previewClassName: string;
    icon: ReactNode;
};

const ThemeSelector = () => {
    const { theme, setTheme } = useTheme();
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const options: ThemeOption[] = [
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

    const selectedIndex = options.findIndex((option) => option.theme === theme);

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
        <Container className='theme-selector-grid gap-1' role='radiogroup' aria-label='Theme selector'>
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
                    isSelected={theme === option.theme}
                    onClick={() => setTheme(option.theme)}
                    onKeyDown={handleKeyDown(index)}
                    tabIndex={index === selectedIndex ? 0 : -1}
                />
            ))}
        </Container>
    );
};

export default ThemeSelector;

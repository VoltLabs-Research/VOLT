import ThemeCard from '@/modules/auth/components/ThemeCard';
import { Theme, useTheme } from '@/shared/ui/hooks/use-theme';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

interface ThemeOption {
    theme: Theme;
    label: string;
    icon: ReactNode;
}

const ThemeSelector = () => {
    const { preference, setTheme } = useTheme();
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const options: ThemeOption[] = [
        {
            theme: Theme.System,
            label: 'System',
            icon: <Monitor size={34} />
        },
        {
            theme: Theme.Light,
            label: 'Light',
            icon: <Sun size={28} />
        },
        {
            theme: Theme.Dark,
            label: 'Dark',
            icon: <Moon size={28} />
        }
    ];

    const selectedIndex = options.findIndex((option) => option.theme === preference);

    const selectOption = (index: number): void => {
        setTheme(options[index].theme);
        optionRefs.current[index]?.focus();
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
        <div className='grid grid-cols-2 items-stretch gap-4' role='radiogroup' aria-label='Theme selector'>
            {options.map((option, index) => (
                <ThemeCard
                    key={option.theme}
                    ref={(element) => {
                        optionRefs.current[index] = element;
                    }}
                    theme={option.theme}
                    label={option.label}
                    icon={option.icon}
                    isSelected={preference === option.theme}
                    onClick={() => setTheme(option.theme)}
                    onKeyDown={handleKeyDown(index)}
                    tabIndex={index === selectedIndex ? 0 : -1}
                />
            ))}
        </div>
    );
};

export default ThemeSelector;

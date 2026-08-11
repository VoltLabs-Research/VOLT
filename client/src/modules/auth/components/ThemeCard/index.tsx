import { cn } from '@heroui/react';
import { Theme } from '@/shared/ui/hooks/use-theme';
import { Check } from 'lucide-react';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ThemeCardProps {
    theme: Theme;
    label: string;
    icon: ReactNode;
    isSelected: boolean;
    onClick: () => void;
    onKeyDown: ButtonHTMLAttributes<HTMLButtonElement>['onKeyDown'];
    tabIndex: number;
}

const ThemeCard = forwardRef<HTMLButtonElement, ThemeCardProps>(({
    theme,
    label,
    icon,
    isSelected,
    onClick,
    onKeyDown,
    tabIndex
}, ref) => {
    let preview = (
        <div className='relative h-[140px] w-full overflow-hidden border-b border-border/70'>
            <div className='light absolute inset-0 bg-background [clip-path:polygon(0_0,calc(50%_+_70px)_0,calc(50%_-_70px)_100%,0_100%)]' />
            <div className='dark absolute inset-0 bg-background [clip-path:polygon(calc(50%_+_70px)_0,100%_0,100%_100%,calc(50%_-_70px)_100%)]' />
            <div className='dark absolute top-1/2 left-1/2 h-px w-[220px] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[color-mix(in_srgb,var(--foreground)_22%,transparent)]' />
            <div className='dark relative flex h-full items-center justify-center text-[#a0a0a0] [filter:drop-shadow(0_0_14px_color-mix(in_srgb,var(--background)_70%,transparent))_drop-shadow(0_2px_4px_rgba(0,0,0,0.35))]'>{icon}</div>
        </div>
    );

    if (theme !== Theme.System) {
        preview = (
            <div className='relative h-[140px] w-full overflow-hidden border-b border-border/70'>
                <div className={cn('flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,var(--background)_0%,var(--surface-secondary)_100%)] text-foreground', theme === Theme.Dark ? 'dark' : 'light')}>
                    <div className='absolute top-[18px] right-5 left-5 flex h-[18px] items-center gap-1.5 rounded-t-[7px] px-[7px] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-tertiary)_100%)] shadow-[inset_0_0_0_1px_var(--border),0_1px_0_0_color-mix(in_srgb,var(--border)_60%,transparent)]'>
                        <span className='size-1.5 rounded-full bg-[#ff5f57]' />
                        <span className='size-1.5 rounded-full bg-[#febc2e]' />
                        <span className='size-1.5 rounded-full bg-[#28c840]' />
                    </div>
                    <div className='absolute top-9 right-5 bottom-[18px] left-5 rounded-b-[7px] bg-[linear-gradient(135deg,var(--info-soft)_0%,color-mix(in_srgb,var(--info)_20%,transparent)_100%)] shadow-[inset_0_0_0_1px_var(--border)]' />
                    <div className='relative mt-[18px] opacity-[0.72] [filter:drop-shadow(0_3px_10px_color-mix(in_srgb,currentColor_30%,transparent))]'>{icon}</div>
                </div>
            </div>
        );
    }

    return (
        <button
            ref={ref}
            type='button'
            role='radio'
            aria-checked={isSelected}
            aria-label={`${label} theme`}
            data-theme-preview={theme}
            tabIndex={tabIndex}
            onClick={onClick}
            onKeyDown={onKeyDown}
            className={cn(
                'relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-2xl border bg-surface-secondary text-center transition-[border-color,box-shadow,background-color] duration-150 ease-out-fluid',
                isSelected ? 'border-accent shadow-[0_0_0_1px_var(--accent)]' : 'border-border hover:border-border-secondary hover:bg-surface-tertiary'
            )}
        >
            {isSelected && (
                <span className='absolute top-2 right-2 rounded-full bg-accent px-2 py-[2px] text-accent-foreground'>
                    <Check size={14} aria-hidden='true' />
                </span>
            )}
            <h3 className='text-sm font-[550] text-foreground'>{label}</h3>
            {preview}
        </button>
    );
});

ThemeCard.displayName = 'ThemeCard';

export default ThemeCard;

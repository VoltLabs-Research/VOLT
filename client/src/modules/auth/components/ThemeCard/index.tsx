import { cn } from '@heroui/react';
import { Theme } from '@/shared/ui/hooks/use-theme';
import { Check } from 'lucide-react';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/*
 * A preview shows a theme that is NOT the active one, so its colours cannot be
 * read off the document — only the active theme is computed there. bravais solved
 * that by parsing its own token sheet as raw text and re-emitting the values as
 * `--theme-preview-*` custom properties from JS.
 *
 * None of that is needed now: `.light` and `.dark` are ordinary class selectors
 * in the app's stylesheet (and in HeroUI's, which owns the light values VOLT does
 * not override), so putting one of them on a subtree gives that subtree the whole
 * opposite palette. The preview is then drawn with ordinary token utilities,
 * which resolve against the scoped theme rather than the active one. No parsing,
 * no duplicated colour values, and a token edited in one place moves the previews
 * with it.
 */
const PREVIEW_FRAME = 'relative h-[140px] w-full overflow-hidden border-b border-border/70';
const PREVIEW_BODY = 'flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,var(--background)_0%,var(--surface-secondary)_100%)] text-foreground';
const PREVIEW_TITLEBAR = 'absolute top-[18px] right-5 left-5 flex h-[18px] items-center gap-1.5 rounded-t-[7px] px-[7px] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-tertiary)_100%)] shadow-[inset_0_0_0_1px_var(--border),0_1px_0_0_color-mix(in_srgb,var(--border)_60%,transparent)]';
const PREVIEW_PANEL = 'absolute top-9 right-5 bottom-[18px] left-5 rounded-b-[7px] bg-[linear-gradient(135deg,var(--info-soft)_0%,color-mix(in_srgb,var(--info)_20%,transparent)_100%)] shadow-[inset_0_0_0_1px_var(--border)]';
const PREVIEW_ICON = 'relative mt-[18px] opacity-[0.72] [filter:drop-shadow(0_3px_10px_color-mix(in_srgb,currentColor_30%,transparent))]';

/*
 * The system preview is a hard-edged 45° split — light above-left, dark
 * below-right — which was one `linear-gradient(135deg, …)` carrying colour stops
 * from two different themes at once. Two clipped layers replace it so each half
 * can carry its own theme class and read its own `--background`. The 70px offsets
 * are half the frame's 140px height: that is where a 45° line through the centre
 * meets the top and bottom edges.
 */
const SYSTEM_LIGHT_HALF = 'light absolute inset-0 bg-background [clip-path:polygon(0_0,calc(50%_+_70px)_0,calc(50%_-_70px)_100%,0_100%)]';
const SYSTEM_DARK_HALF = 'dark absolute inset-0 bg-background [clip-path:polygon(calc(50%_+_70px)_0,100%_0,100%_100%,calc(50%_-_70px)_100%)]';
const SYSTEM_SEAM = 'dark absolute top-1/2 left-1/2 h-px w-[220px] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[color-mix(in_srgb,var(--foreground)_22%,transparent)]';
const SYSTEM_ICON = 'dark relative flex h-full items-center justify-center text-[#a0a0a0] [filter:drop-shadow(0_0_14px_color-mix(in_srgb,var(--background)_70%,transparent))_drop-shadow(0_2px_4px_rgba(0,0,0,0.35))]';

const CARD = 'relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-2xl border bg-surface-secondary text-center transition-[border-color,box-shadow,background-color] duration-150 ease-out-fluid';
const CARD_SELECTED = 'border-accent shadow-[0_0_0_1px_var(--accent)]';
const CARD_IDLE = 'border-border hover:border-border-secondary hover:bg-surface-tertiary';
const BADGE = 'absolute top-2 right-2 rounded-full bg-accent px-2 py-[2px] text-accent-foreground';

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
        <div className={PREVIEW_FRAME}>
            <div className={SYSTEM_LIGHT_HALF} />
            <div className={SYSTEM_DARK_HALF} />
            <div className={SYSTEM_SEAM} />
            <div className={SYSTEM_ICON}>{icon}</div>
        </div>
    );

    if (theme !== Theme.System) {
        preview = (
            <div className={PREVIEW_FRAME}>
                <div className={cn(PREVIEW_BODY, theme === Theme.Dark ? 'dark' : 'light')}>
                    <div className={PREVIEW_TITLEBAR}>
                        <span className='size-1.5 rounded-full bg-[#ff5f57]' />
                        <span className='size-1.5 rounded-full bg-[#febc2e]' />
                        <span className='size-1.5 rounded-full bg-[#28c840]' />
                    </div>
                    <div className={PREVIEW_PANEL} />
                    <div className={PREVIEW_ICON}>{icon}</div>
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
            className={cn(CARD, isSelected ? CARD_SELECTED : CARD_IDLE)}
        >
            {isSelected && (
                <span className={BADGE}>
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

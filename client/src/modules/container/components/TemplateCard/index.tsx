import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface TemplateCardProps {
    name: string;
    description: string;
    icon: ReactNode;
    isSelected: boolean;
    onClick: () => void;
    /**
     * Still accepted because `ImageSelectionStep` passes it, but it no longer
     * reaches the DOM: it only ever produced `create-container-template-card
     * default|custom`, and none of those three classes was defined in any
     * stylesheet in the app.
     */
    variant?: 'default' | 'custom';
}

/**
 * bravais's `SelectableCard`, rebuilt as the plain `<button>` it always was.
 *
 * It stays a DOM button rather than becoming a HeroUI `Button` for two reasons:
 * the a11y contract is `role='radio'` + `aria-checked`, which React Aria's Button
 * would fight, and the card's paint is nothing like a button's.
 *
 * Reproduced deliberately, element for element and value for value — including the
 * inner `<div>` and `<h3>`, which are not valid inside a `<button>` but are what
 * shipped and what the page's heading outline currently contains:
 *
 *   • `padding: 1.25rem 1rem` — asymmetric and off Tailwind's scale.
 *   • `border-radius: var(--radius-lg)` was bravais's 16px, which is `rounded-2xl`
 *     here. `rounded-lg` would be 8px: the single most dangerous same-name radius
 *     in this migration.
 *   • The hover step was gated behind `@media (hover: hover) and (pointer: fine)`.
 *     Tailwind 4's `hover:` variant carries that media query itself, so the two
 *     hover utilities are the gate as well as the effect.
 *   • The selected state is a brand border *plus* a 1px brand ring, which is what
 *     makes the edge read heavier without shifting layout. Under VOLT's monochrome
 *     identity `--color-brand-primary` is `--accent`.
 *   • focus-visible used the card's OWN ring — a border-colour change plus a 3px
 *     25%-alpha halo — not the app's shared focus token, so it is restated here
 *     rather than left to the global `outline` rule.
 *
 * The icon sat in an `aria-hidden` `IconFrame` at `size='lg' shape='square'
 * tone='brand'`: 56px, a 12px radius, and the info-tinted surface that bravais's
 * brand tone borrowed (`--status-info-bg` / `--status-info-border`) with the brand
 * colour — the foreground here — for the glyph.
 */
const CARD_CLASS_NAMES = 'relative cursor-pointer rounded-2xl border border-border bg-surface-secondary px-4 py-5 text-center transition-[border-color,box-shadow,transform,background-color] duration-150 ease-out hover:border-border-secondary hover:bg-surface-tertiary focus-visible:border-[var(--focus)] focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_25%,transparent)] focus-visible:outline-none';
const CARD_SELECTED_CLASS_NAMES = 'border-accent shadow-[0_0_0_1px_var(--accent)]';
const ICON_FRAME_CLASS_NAMES = 'inline-flex size-14 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_oklab,var(--info)_28%,transparent)] bg-info-soft text-foreground';

const TemplateCard = ({
    name,
    description,
    icon,
    isSelected,
    onClick
}: TemplateCardProps) => (
    <button
        type='button'
        className={cn(CARD_CLASS_NAMES, isSelected && CARD_SELECTED_CLASS_NAMES)}
        role='radio'
        aria-checked={isSelected}
        aria-label={`${name}${isSelected ? ', selected' : ''}`}
        onClick={onClick}
    >
        <div className='flex flex-col items-center gap-3 text-center'>
            <div className={ICON_FRAME_CLASS_NAMES} aria-hidden='true'>{icon}</div>
            <h3 className='text-sm font-[550] text-foreground'>{name}</h3>
            <span className='text-xs leading-normal text-muted'>{description}</span>
        </div>
    </button>
);

export default TemplateCard;

import { Button, cn } from '@heroui/react';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * bravais's `DashedActionBox` — the dashed "add another one" affordance — on HeroUI's
 * `Button`.
 *
 * Spec §4c maps it to a `<div>` plus utilities "keeping press behaviour via `Button`
 * if it was clickable", and it always was: bravais rendered a `<button>`. Staying on
 * `Button` also keeps the two things a bare element would lose — React Aria's press
 * handling and the `pointer: coarse` touch-target floor `index.css` declares for
 * `.button--sm`.
 *
 * Both call sites in this module pass `size='sm' block`, so those are baked in rather
 * than exposed. `tone` was always the default `muted`.
 *
 * Token conversions: `--color-border-strong` is `--border-secondary`, `--radius-md` is
 * 12px so `rounded-xl` (spec §3b), and the hover border's `--color-brand-primary` is
 * `--accent`. `h-auto` is needed because HeroUI's `.button--sm` pins a height and
 * bravais's box was sized by its padding.
 */
const DASHED_ACTION_CLASS = 'h-auto gap-2 rounded-xl border border-dashed border-border-secondary bg-transparent px-3 py-2 text-xs text-muted shadow-none transition-[border-color,background-color,color] duration-150 ease-out hover:border-accent hover:bg-surface-hover hover:text-foreground';

interface DashedActionBoxProps {
    label: ReactNode;
    onPress: () => void;
    icon?: ReactNode;
    /** bravais's `block`: fills its container. */
    isBlock?: boolean;
    isDisabled?: boolean;
    className?: string;
};

const DashedActionBox = ({ label, onPress, icon, isBlock = false, isDisabled, className }: DashedActionBoxProps) => (
    <Button
        size='sm'
        variant='ghost'
        fullWidth={isBlock}
        isDisabled={isDisabled}
        onPress={onPress}
        className={cn(DASHED_ACTION_CLASS, className)}
    >
        <span aria-hidden='true' className='inline-flex flex-row items-center'>
            {icon ?? <Plus size={16} />}
        </span>
        <span>{label}</span>
    </Button>
);

export default DashedActionBox;

import { Search } from 'lucide-react';
import { cn } from '@heroui/react';

import type { ComponentPropsWithRef } from 'react';

interface CanvasSearchInputProps extends Omit<ComponentPropsWithRef<'input'>, 'className' | 'type'> {
    /** bravais's `variant`: `small` was the dense canvas-chrome size. */
    variant?: 'default' | 'small';
    /** Lands on the bordered container. */
    containerClassName?: string;
    /** Lands on the input itself. */
    className?: string;
}

/**
 * bravais's `SearchInput`, rebuilt as a plain bordered box around a plain `<input>`.
 *
 * It is deliberately NOT HeroUI's `SearchField`. Both call sites in this module fight it:
 * the plugin search is a `role='combobox'` that owns its own listbox and needs Escape to
 * close that listbox, and the command palette needs Escape to close the modal — while
 * React Aria's `SearchField` claims Escape to clear the field. Keeping the element plain
 * preserves both, and the spec is explicit that a control needing its own event semantics
 * should stay a plain element (§4b).
 *
 * The focus ring is dropped rather than translated: `index.css` rings every plain input
 * with `outline: 2px solid var(--focus)`, which is what bravais's `:focus-within`
 * box-shadow was for.
 */
const CONTAINER_CLASS: Record<'default' | 'small', string> = {
    default: 'flex w-full min-h-10 items-center gap-2 rounded-2xl border border-border bg-transparent px-3 py-[0.4375rem] transition-colors duration-150 ease-out focus-within:border-accent',
    small: 'inline-flex w-auto min-h-[2.125rem] flex-none items-center gap-1 rounded-lg border border-border bg-transparent px-1.5 transition-colors duration-150 ease-out focus-within:border-accent'
};

const INPUT_CLASS: Record<'default' | 'small', string> = {
    default: 'relative z-[1] w-full min-w-0 border-none bg-transparent outline-none placeholder:text-muted',
    small: 'relative z-[1] w-full min-w-0 border-none bg-transparent text-xs leading-none text-muted outline-none placeholder:text-muted'
};

const CanvasSearchInput = ({
    variant = 'default',
    containerClassName,
    className,
    ...inputProps
}: CanvasSearchInputProps) => (
    <div className={cn(CONTAINER_CLASS[variant], containerClassName)}>
        <Search className='size-3.5 shrink-0 text-muted' aria-hidden='true' />
        <div className='flex min-w-0 flex-1 items-center'>
            <input type='search' className={cn(INPUT_CLASS[variant], className)} {...inputProps} />
        </div>
    </div>
);

export default CanvasSearchInput;

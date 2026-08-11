import { Search } from 'lucide-react';
import { cn } from '@heroui/react';

import type { ComponentPropsWithRef } from 'react';

interface CanvasSearchInputProps extends Omit<ComponentPropsWithRef<'input'>, 'className' | 'type'> {
    variant?: 'default' | 'small';

    containerClassName?: string;

    className?: string;
}

const CanvasSearchInput = ({
    variant = 'default',
    containerClassName,
    className,
    ...inputProps
}: CanvasSearchInputProps) => (
    <div className={cn(
        variant === 'small'
            ? 'inline-flex w-auto min-h-[2.125rem] flex-none items-center gap-1 rounded-lg border border-border bg-transparent px-1.5 transition-colors duration-150 ease-out focus-within:border-accent'
            : 'flex w-full min-h-10 items-center gap-2 rounded-2xl border border-border bg-transparent px-3 py-[0.4375rem] transition-colors duration-150 ease-out focus-within:border-accent',
        containerClassName
    )}>
        <Search className='size-3.5 shrink-0 text-muted' aria-hidden='true' />
        <div className='flex min-w-0 flex-1 items-center'>
            <input
                type='search'
                className={cn(
                    variant === 'small'
                        ? 'relative z-[1] w-full min-w-0 border-none bg-transparent text-xs leading-none text-muted outline-none placeholder:text-muted'
                        : 'relative z-[1] w-full min-w-0 border-none bg-transparent outline-none placeholder:text-muted',
                    className
                )}
                {...inputProps}
            />
        </div>
    </div>
);

export default CanvasSearchInput;

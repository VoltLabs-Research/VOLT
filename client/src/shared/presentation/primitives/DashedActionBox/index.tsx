import { cn } from '@/shared/utils/cn';
import './DashedActionBox.css';
import { Plus } from 'lucide-react';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type DashedActionTone = 'muted' | 'brand';
export type DashedActionSize = 'sm' | 'md' | 'lg';

export interface DashedActionBoxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    icon?: ReactNode;
    label: ReactNode;
    tone?: DashedActionTone;
    size?: DashedActionSize;
    block?: boolean;
    children?: ReactNode;
}

/**
 * Dashed-border "add X" call-to-action button. Consolidates the
 * add-argument, add-option, add-field, file-dropzone patterns.
 */
const DashedActionBox = forwardRef<HTMLButtonElement, DashedActionBoxProps>(({
    icon,
    label,
    tone = 'muted',
    size = 'md',
    block = false,
    className,
    children,
    type = 'button',
    ...rest
}, ref) => {
    const classes = cn(
        'volt-dashed-action',
        `volt-dashed-action--tone-${tone}`,
        `volt-dashed-action--size-${size}`,
        block && 'volt-dashed-action--block',
        className
    );

    return (
        <button ref={ref} type={type} className={classes} {...rest}>
            <span className='volt-dashed-action__icon' aria-hidden='true'>
                {icon ?? <Plus size={16} />}
            </span>
            <span className='volt-dashed-action__label'>{label}</span>
            {children}
        </button>
    );
});

DashedActionBox.displayName = 'DashedActionBox';

export default DashedActionBox;

import { cn } from '@/shared/utils/cn';
import Stack from '../Stack';
import Text from '../Text';
import Heading from '../Heading';
import IconFrame from '../IconFrame';
import './SelectableCard.css';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { IconFrameTone } from '../IconFrame';

export interface SelectableCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'onSelect'> {
    title: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    iconTone?: IconFrameTone;
    selected?: boolean;
    badge?: ReactNode;
    /**
     * `radio` for mutually-exclusive groups (single selection),
     * `checkbox` for multi-select.
     */
    selectionRole?: 'radio' | 'checkbox';
    onSelect?: () => void;
}

/**
 * Toggleable card with selected ring. Consolidates ~3 onboarding/creation
 * card shapes (template cards, cluster-onboarding choices, create-container
 * template selectors).
 */
const SelectableCard = forwardRef<HTMLButtonElement, SelectableCardProps>(({
    title,
    description,
    icon,
    iconTone = 'brand',
    selected = false,
    badge,
    selectionRole,
    onSelect,
    onClick,
    className,
    children,
    type = 'button',
    ...rest
}, ref) => {
    const classes = cn(
        'volt-selectable-card',
        selected && 'volt-selectable-card--selected',
        className
    );

    const ariaProps = selectionRole === 'radio'
        ? { role: 'radio', 'aria-checked': selected }
        : selectionRole === 'checkbox'
            ? { role: 'checkbox', 'aria-checked': selected }
            : { 'aria-pressed': selected };

    return (
        <button
            ref={ref}
            type={type}
            className={classes}
            onClick={(event) => {
                onSelect?.();
                onClick?.(event);
            }}
            {...ariaProps}
            {...rest}
        >
            {badge && <span className='volt-selectable-card__badge'>{badge}</span>}
            <Stack align='center' gap='075' textAlign='center'>
                {icon && (
                    <IconFrame size='lg' tone={iconTone}>
                        {icon}
                    </IconFrame>
                )}
                <Heading level={3} size='md' weight='semibold'>
                    {title}
                </Heading>
                {description && (
                    <Text size='sm' tone='secondary' lineHeight='5'>
                        {description}
                    </Text>
                )}
                {children}
            </Stack>
        </button>
    );
});

SelectableCard.displayName = 'SelectableCard';

export default SelectableCard;

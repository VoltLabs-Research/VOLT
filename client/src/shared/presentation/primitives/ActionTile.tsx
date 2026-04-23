import { cn } from '@/shared/utils';
import Stack from './Stack';
import Row from './Row';
import Text from './Text';
import Heading from './Heading';
import IconFrame from './IconFrame';
import './ActionTile.css';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { IconFrameTone } from './IconFrame';

export interface ActionTileProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
    title: ReactNode;
    subtitle?: ReactNode;
    icon?: ReactNode;
    iconTone?: IconFrameTone;
    cta?: ReactNode;
    /** If provided, renders as a react-router Link instead of a button. */
    to?: string;
    hideChevron?: boolean;
}

/**
 * Clickable navigation tile with icon + title + subtitle + trailing chevron.
 * Keyboard-accessible out of the box. Use for dashboard cards, Start-page
 * tiles, or any content-summary tile that navigates/acts on click.
 */
const ActionTile = forwardRef<HTMLElement, ActionTileProps>(({
    title,
    subtitle,
    icon,
    iconTone = 'brand',
    cta,
    to,
    hideChevron = false,
    className,
    onClick,
    children,
    type = 'button',
    ...rest
}, ref) => {
    const classes = cn('volt-action-tile', className);

    const content = (
        <>
            <Stack gap='075' align='start' flex='1' minW='0'>
                {icon && (
                    <IconFrame size='md' tone={iconTone}>
                        {icon}
                    </IconFrame>
                )}
                <Stack gap='025' align='start'>
                    <Heading level={3} size='md' weight='semibold' tone='primary'>
                        {title}
                    </Heading>
                    {subtitle && (
                        <Text size='sm' tone='secondary' lineHeight='5'>
                            {subtitle}
                        </Text>
                    )}
                </Stack>
                {children}
            </Stack>
            {!hideChevron && (
                <Row gap='025' align='center' className='volt-action-tile__cta'>
                    {cta && <Text size='sm' tone='secondary'>{cta}</Text>}
                    <ChevronRight size={16} aria-hidden='true' />
                </Row>
            )}
        </>
    );

    if (to) {
        return (
            <Link
                ref={ref as React.Ref<HTMLAnchorElement>}
                to={to}
                className={classes}
                {...(rest as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            ref={ref as React.Ref<HTMLButtonElement>}
            type={type}
            className={classes}
            onClick={onClick}
            {...rest}
        >
            {content}
        </button>
    );
});

ActionTile.displayName = 'ActionTile';

export default ActionTile;

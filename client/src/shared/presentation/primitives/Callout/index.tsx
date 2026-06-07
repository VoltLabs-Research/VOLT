import './Callout.css';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { cn } from '@/shared/utils/cn';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';

export type CalloutTone = 'danger' | 'warning' | 'info' | 'success';

type ButtonIntent = 'neutral' | 'brand' | 'danger' | 'success';

interface CalloutAction {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    isLoading?: boolean;
    disabled?: boolean;
};

interface CalloutProps {
    tone: CalloutTone;
    title?: string;
    description?: string;
    message?: ReactNode;
    icon?: ReactNode;
    action?: CalloutAction;
    children?: ReactNode;
    className?: string;
    ariaLabel?: string;
    role?: string;
    ariaLive?: 'off' | 'polite' | 'assertive';
};

const toneToIntent: Record<CalloutTone, ButtonIntent> = {
    danger: 'danger',
    warning: 'neutral',
    info: 'brand',
    success: 'success'
};

const Callout = forwardRef<HTMLDivElement, CalloutProps>(({
    tone,
    title,
    description,
    message,
    icon,
    action,
    children,
    className,
    ariaLabel,
    role,
    ariaLive
}, ref) => {
    const hasHeaderContent = Boolean(title || description);
    const layout = hasHeaderContent ? 'stacked' : 'inline';

    const resolvedRole = role ?? (hasHeaderContent ? 'region' : 'status');
    const resolvedAriaLive = ariaLive ?? (hasHeaderContent ? undefined : 'polite');
    const resolvedAriaLabel = ariaLabel ?? title;

    const classes = cn(
        'volt-callout',
        `volt-callout--tone-${tone}`,
        `volt-callout--layout-${layout}`,
        className
    );

    if (layout === 'inline') {
        return (
            <div
                ref={ref}
                className={classes}
                role={resolvedRole}
                aria-live={resolvedAriaLive}
                aria-label={resolvedAriaLabel}
            >
                <Row gap='05' className='font-size-2'>
                    {icon && <span className='volt-callout__icon'>{icon}</span>}
                    <div className='volt-callout__body'>
                        {message ?? children}
                    </div>
                </Row>
            </div>
        );
    }

    return (
        <div
            ref={ref}
            className={classes}
            role={resolvedRole}
            aria-live={resolvedAriaLive}
            aria-label={resolvedAriaLabel}
        >
            <Row justify='between' gap='1'>
                <Stack gap='025'>
                    {title && (
                        <Heading level={2} size='md' weight='bold'>
                            {title}
                        </Heading>
                    )}
                    {description && (
                        <Text as='p' tone='muted' size='sm'>
                            {description}
                        </Text>
                    )}
                    {children}
                </Stack>
                {action && (
                    <Button
                        intent={toneToIntent[tone]}
                        variant='outline'
                        size='sm'
                        leftIcon={action.icon}
                        onClick={action.onClick}
                        isLoading={action.isLoading}
                        disabled={action.disabled}
                    >
                        {action.label}
                    </Button>
                )}
            </Row>
        </div>
    );
});

Callout.displayName = 'Callout';

export default Callout;

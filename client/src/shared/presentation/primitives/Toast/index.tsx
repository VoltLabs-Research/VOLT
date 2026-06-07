import './Toast.css';
import CloseButton from '../CloseButton';
import IconFrame from '../IconFrame';
import Row from '../Row';
import Stack from '../Stack';
import Surface from '../Surface';
import Text from '../Text';
import { cn } from '@/shared/utils/cn';
import { Bell, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import type { StatusTone } from '../types';

export type ToastTone = StatusTone;

export interface ToastProps {
    /** Semantic tone — drives the default icon, tint and aria-live politeness. */
    tone?: ToastTone;
    /** Optional bold heading shown above the message. */
    title?: ReactNode;
    /** Primary body content. Required. */
    message: ReactNode;
    /** Override the default tone icon. Pass `null` to hide it entirely. */
    icon?: ReactNode;
    /** When provided, renders a dismiss (close) button wired to this handler. */
    onDismiss?: () => void;
    /** Optional trailing action node (e.g. a Button or link). */
    action?: ReactNode;
    /** Accessible label for the dismiss button. */
    dismissLabel?: string;
    /**
     * Override the live-region politeness. Defaults to `assertive` for
     * `danger`, `polite` otherwise.
     */
    ariaLive?: 'polite' | 'assertive' | 'off';
    className?: string;
}

const DEFAULT_TONE_ICON: Record<ToastTone, ReactNode> = {
    neutral: <Bell size={18} />,
    brand: <Info size={18} />,
    success: <CircleCheck size={18} />,
    warning: <TriangleAlert size={18} />,
    danger: <CircleAlert size={18} />,
    info: <Info size={18} />
};

/**
 * Presentational toast / notification unit. This is the visual surface the
 * app's `AppToaster` system renders — it owns no timers, no portal and no
 * stacking; it is a pure, accessible building block.
 *
 * Composes {@link Surface} (elevated card), {@link IconFrame} (tinted tone
 * glyph), {@link Text} and {@link CloseButton}.
 */
const Toast = forwardRef<HTMLDivElement, ToastProps>(({
    tone = 'neutral',
    title,
    message,
    icon,
    onDismiss,
    action,
    dismissLabel = 'Dismiss notification',
    ariaLive,
    className
}, ref) => {
    const resolvedAriaLive = ariaLive ?? (tone === 'danger' ? 'assertive' : 'polite');
    const showIcon = icon !== null;
    const resolvedIcon = icon ?? DEFAULT_TONE_ICON[tone];

    return (
        <Surface
            ref={ref}
            variant='elevated'
            role='status'
            aria-live={resolvedAriaLive}
            aria-atomic='true'
            className={cn('volt-toast', `volt-toast--tone-${tone}`, className)}
        >
            <Row align='start' gap='075' className='volt-toast__layout'>
                {showIcon && (
                    <IconFrame tone={tone} size='sm' className='volt-toast__icon'>
                        {resolvedIcon}
                    </IconFrame>
                )}

                <Stack gap='025' className='volt-toast__body'>
                    {title && (
                        <Text as='p' size='sm' weight='semibold' tone='primary'>
                            {title}
                        </Text>
                    )}
                    <Text as='div' size='sm' tone={title ? 'secondary' : 'primary'}>
                        {message}
                    </Text>
                    {action && (
                        <Row gap='05' className='volt-toast__actions'>
                            {action}
                        </Row>
                    )}
                </Stack>

                {onDismiss && (
                    <div className='volt-toast__dismiss'>
                        <CloseButton onClick={onDismiss} aria-label={dismissLabel} />
                    </div>
                )}
            </Row>
        </Surface>
    );
});

Toast.displayName = 'Toast';

export default Toast;

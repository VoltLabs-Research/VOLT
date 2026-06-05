import { cn } from '@/shared/utils/cn';
import Row from '../Row';
import Text from '../Text';
import Loader from '../Loader';
import { AlertCircle, Check } from 'lucide-react';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveStatusIndicatorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
    status: SaveStatus;
    savingLabel?: string;
    savedLabel?: string;
    errorLabel?: string;
    /** Hide when `idle`. Default: true. */
    hideIdle?: boolean;
}

/**
 * Inline save-state indicator (saving / saved / error) with live-region
 * announcement. Consolidates plugin/latex/whiteboard "Saved" pills.
 */
const SaveStatusIndicator = forwardRef<HTMLDivElement, SaveStatusIndicatorProps>(({
    status,
    savingLabel = 'Saving…',
    savedLabel = 'Saved',
    errorLabel = 'Save failed',
    hideIdle = true,
    className,
    ...rest
}, ref) => {
    if (hideIdle && status === 'idle') return null;

    const tone = status === 'saved' ? 'muted' : 'secondary';
    const errorStyle = status === 'error' ? { color: 'var(--status-error)' } : undefined;

    return (
        <Row
            ref={ref}
            gap='025'
            role='status'
            aria-live='polite'
            aria-atomic='true'
            className={cn('font-size-1', className)}
            style={errorStyle}
            {...rest}
        >
            {status === 'saving' && <Loader scale={0.35} isFixed={false} />}
            {status === 'saved' && <Check size={12} aria-hidden='true' />}
            {status === 'error' && <AlertCircle size={12} aria-hidden='true' />}
            <Text as='span' size='sm' tone={status === 'error' ? undefined : tone}>
                {status === 'saving' && savingLabel}
                {status === 'saved' && savedLabel}
                {status === 'error' && errorLabel}
            </Text>
        </Row>
    );
});

SaveStatusIndicator.displayName = 'SaveStatusIndicator';

export default SaveStatusIndicator;

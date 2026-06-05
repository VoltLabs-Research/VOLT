import { cn } from '@/shared/utils/cn';
import Row from '../Row';
import Text from '../Text';
import Stack from '../Stack';
import IconButton from '../IconButton';
import './KeyValueList.css';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { Check, Copy } from 'lucide-react';
import { forwardRef, useCallback, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export interface KeyValueRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    label: ReactNode;
    value: ReactNode;
    copyValue?: string;
    action?: ReactNode;
    tabular?: boolean;
}

/**
 * Single label/value pair row with optional copy action or custom trailing
 * action slot. Intended for use inside `KeyValueList`.
 */
export const KeyValueRow = forwardRef<HTMLDivElement, KeyValueRowProps>(({
    label,
    value,
    copyValue,
    action,
    tabular = false,
    className,
    ...rest
}, ref) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        if (!copyValue) return;
        const ok = await copyTextToClipboard(copyValue);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        }
    }, [copyValue]);

    return (
        <div ref={ref} className={cn('volt-kv-row', className)} {...rest}>
            <Text as='span' size='sm' tone='secondary' className='volt-kv-row__label'>
                {label}
            </Text>
            <Row gap='05' align='center' className='volt-kv-row__value-group'>
                <Text
                    as='span'
                    size='sm'
                    tone='primary'
                    weight='medium'
                    className={cn('volt-kv-row__value', tabular && 'tabular-nums')}
                >
                    {value}
                </Text>
                {copyValue && (
                    <IconButton
                        size='sm'
                        variant='ghost'
                        onClick={handleCopy}
                        aria-label={copied ? 'Copied' : 'Copy value'}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </IconButton>
                )}
                {action}
            </Row>
        </div>
    );
});

KeyValueRow.displayName = 'KeyValueRow';

export interface KeyValueListProps extends HTMLAttributes<HTMLDivElement> {
    dividers?: boolean;
    children?: ReactNode;
}

/**
 * Definition-style list. Renders each child `KeyValueRow` with consistent
 * spacing and optional inter-row dividers.
 */
const KeyValueList = forwardRef<HTMLDivElement, KeyValueListProps>(({
    dividers = true,
    className,
    children,
    ...rest
}, ref) => {
    return (
        <Stack
            ref={ref}
            className={cn('volt-kv-list', dividers && 'volt-kv-list--dividers', className)}
            {...rest}
        >
            {children}
        </Stack>
    );
});

KeyValueList.displayName = 'KeyValueList';

export default KeyValueList;

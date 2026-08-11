import { Button, cn } from '@heroui/react';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

const COPIED_RESET_DELAY_MS = 1400;

interface ContainerKeyValueListProps {
    dividers?: boolean;
    className?: string;
    children?: ReactNode;
};

export const ContainerKeyValueList = ({ dividers = true, className, children }: ContainerKeyValueListProps) => (
    <div className={cn('flex flex-col', dividers && '[&>*+*]:border-t [&>*+*]:border-border', className)}>
        {children}
    </div>
);

interface ContainerKeyValueRowProps {
    label: ReactNode;
    value: ReactNode;
    copyValue?: string;
    action?: ReactNode;
    tabular?: boolean;
    className?: string;
};

export const ContainerKeyValueRow = ({
    label,
    value,
    copyValue,
    action,
    tabular = false,
    className
}: ContainerKeyValueRowProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!copyValue) {
            return;
        }

        const isCopied = await copyTextToClipboard(copyValue);

        if (!isCopied) {
            return;
        }

        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_RESET_DELAY_MS);
    };

    return (
        <div className={cn('flex min-w-0 flex-row items-center justify-between gap-4 py-2.5 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-1', className)}>
            <span className='min-w-0 shrink-0 text-xs text-muted'>{label}</span>
            <div className='flex min-w-0 flex-row items-center gap-2'>
                <span className={cn('min-w-0 break-words text-right text-xs font-medium text-foreground max-[480px]:text-left', tabular && 'tabular-nums')}>{value}</span>
                {copyValue && (
                    <Button
                        variant='ghost'
                        size='sm'
                        isIconOnly
                        aria-label={copied ? 'Copied' : 'Copy value'}
                        onPress={() => { void handleCopy(); }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                )}
                {action}
            </div>
        </div>
    );
};

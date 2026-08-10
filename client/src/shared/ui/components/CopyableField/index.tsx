import { Button, cn } from '@heroui/react';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface CopyableFieldProps {
    value: string;
    successMessage?: string;
    className?: string;
};

/**
 * `copyable-field` and `copyable-field-value` carry no rules of their own any
 * more — both are hooks two other modules reach in by name:
 * `.cluster-install-command-picker .copyable-field { min-width: 0 }` and
 * `.trajectory-share-link-field .copyable-field-value { font-size: 0.7rem }`.
 * They stay until those two call sites express the same thing on their own
 * elements; dropping them here would silently unstyle both.
 */
const FIELD_CLASS_NAMES = 'copyable-field flex flex-row items-center justify-between gap-4 rounded-xl border border-border bg-surface-tertiary/55 p-4';
const VALUE_CLASS_NAMES = 'copyable-field-value break-all font-mono text-sm text-foreground';

const CopyableField = ({ value, successMessage = 'Copied to clipboard', className = '' }: CopyableFieldProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const isCopied = await copyTextToClipboard(value, { successMessage });

        if (!isCopied) {
            return;
        }

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={cn(FIELD_CLASS_NAMES, className)}>
            <p className={VALUE_CLASS_NAMES}>
                {value}
            </p>
            <Button
                variant='ghost'
                isIconOnly
                onPress={() => void handleCopy()}
                aria-label='Copy to clipboard'
            >
                {copied ? <Check className='text-success' /> : <Copy />}
            </Button>
        </div>
    );
};

export default CopyableField;

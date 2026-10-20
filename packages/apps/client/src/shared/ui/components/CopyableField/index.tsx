import { Button, cn } from '@heroui/react';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface CopyableFieldProps {
    value: string;
    successMessage?: string;
    className?: string;
};


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
        <div className={cn('copyable-field flex flex-row items-center justify-between gap-4 rounded-xl border border-border bg-surface-tertiary/55 p-4', className)}>
            <p className='copyable-field-value break-all font-mono text-sm text-foreground'>
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

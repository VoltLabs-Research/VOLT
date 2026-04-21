import './CopyableField.css';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import Button from '@/shared/presentation/components/Button';
import { MdCheck, MdContentCopy } from 'react-icons/md';
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
        <div className={`volt-container copyable-field p-1 d-flex items-center content-between gap-1 ${className}`}>
            <p className='volt-text color-primary copyable-field-value font-size-2'>
                {value}
            </p>
            <Button
                variant='ghost'
                intent='neutral'
                onClick={handleCopy}
                leftIcon={copied ? <MdCheck className='copyable-field-copy-success' /> : <MdContentCopy />}
                aria-label='Copy to clipboard'
            />
        </div>
    );
};

export default CopyableField;

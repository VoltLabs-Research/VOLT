import './CopyableField.css';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { Button, Row, Text } from '@/shared/presentation/primitives';
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
        <Row p='1' justify='between' gap='1' className={`copyable-field ${className}`}>
            <Text as='p' tone='primary' size='md' className='copyable-field-value'>
                {value}
            </Text>
            <Button
                variant='ghost'
                intent='neutral'
                onClick={handleCopy}
                leftIcon={copied ? <MdCheck className='copyable-field-copy-success' /> : <MdContentCopy />}
                aria-label='Copy to clipboard'
            />
        </Row>
    );
};

export default CopyableField;

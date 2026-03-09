import './CopyableField.css';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { MdCheck, MdContentCopy } from 'react-icons/md';
import { sileo } from 'sileo';
import { useState } from 'react';

interface CopyableFieldProps {
    value: string;
    successMessage?: string;
    className?: string;
};

const CopyableField = ({ value, successMessage = 'Copied to clipboard', className = '' }: CopyableFieldProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        sileo.success({ title: successMessage });
    };

    return (
        <Container className={`copyable-field p-1 d-flex items-center content-between gap-1 ${className}`}>
            <Paragraph className='color-primary copyable-field-value font-size-2'>
                {value}
            </Paragraph>
            <Button
                variant='ghost'
                intent='neutral'
                onClick={handleCopy}
                leftIcon={copied ? <MdCheck className='copyable-field-copy-success' /> : <MdContentCopy />}
                aria-label='Copy to clipboard'
            />
        </Container>
    );
};

export default CopyableField;

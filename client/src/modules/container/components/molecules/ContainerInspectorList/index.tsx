import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import './ContainerInspectorList.css';

export interface InspectorRow {
    label: string;
    value: ReactNode;
    copyValue?: string;
};

export interface ContainerInspectorListProps {
    title?: string;
    rows: InspectorRow[];
    className?: string;
};

const CopyButton = ({ value }: { value: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const ok = await copyTextToClipboard(value, { successMessage: 'Copied to clipboard' });
        if (!ok) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            type='button'
            className='container-inspector-list-copy-btn'
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy value'}
            title='Copy'
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
    );
};

const ContainerInspectorList = ({ title, rows, className = '' }: ContainerInspectorListProps) => {
    const visibleRows = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '');

    if (visibleRows.length === 0) {
        return null;
    }

    return (
        <Container className={`container-inspector-list d-flex column ${className}`}>
            {title && (
                <Title as='h3' className='container-inspector-list-title'>
                    {title}
                </Title>
            )}
            <Container className='d-flex column'>
                {visibleRows.map((row) => (
                    <Container
                        key={row.label}
                        className='container-inspector-list-row d-flex items-center content-between'
                    >
                        <span className='container-inspector-list-label'>{row.label}</span>
                        <Container className='d-flex items-center gap-05 min-w-0'>
                            <span className='container-inspector-list-value'>{row.value}</span>
                            {row.copyValue && <CopyButton value={row.copyValue} />}
                        </Container>
                    </Container>
                ))}
            </Container>
        </Container>
    );
};

export default ContainerInspectorList;

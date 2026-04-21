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
        <div className={`volt-container container-inspector-list d-flex column ${className}`}>
            {title && (
                <h3 className='volt-title container-inspector-list-title'>
                    {title}
                </h3>
            )}
            <div className='volt-container d-flex column'>
                {visibleRows.map((row) => (
                    <div key={row.label} className='volt-container container-inspector-list-row d-flex items-center content-between'>
                        <span className='container-inspector-list-label'>{row.label}</span>
                        <div className='volt-container d-flex items-center gap-05 min-w-0'>
                            <span className='container-inspector-list-value'>{row.value}</span>
                            {row.copyValue && <CopyButton value={row.copyValue} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContainerInspectorList;

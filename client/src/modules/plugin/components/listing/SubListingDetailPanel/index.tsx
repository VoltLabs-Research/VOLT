import { X, Copy, Check } from 'lucide-react';
import { useCallback, useState } from 'react';
import IconButton from '@/shared/presentation/primitives/IconButton';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { safeJsonStringify } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';
import { renderExpandedValue } from '@/modules/plugin/components/listing/SubListingDetailPanel/expandedRenderers';
import './SubListingDetailPanel.css';

export interface SubListingDetailColumn {
    key?: string;
    title?: string;
    label?: string;
    path?: string;
};

interface SubListingDetailPanelProps {
    row: Record<string, unknown> | null;
    columns: SubListingDetailColumn[];
    onClose: () => void;
};

const getColumnKey = (col: SubListingDetailColumn): string => String(col.key ?? col.path ?? '');
const getColumnTitle = (col: SubListingDetailColumn): string => String(col.title ?? col.label ?? col.key ?? col.path ?? '');

const resolveRowIdentifier = (row: Record<string, unknown>): string | null => {
    const candidate = row._id ?? row.id;
    if(typeof candidate === 'string' || typeof candidate === 'number'){
        return String(candidate);
    }
    return null;
};

const SubListingDetailPanel = ({ row, columns, onClose }: SubListingDetailPanelProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        if(!row) return;
        const ok = await copyTextToClipboard(safeJsonStringify(row));
        if(ok){
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        }
    }, [row]);

    if(!row){
        return null;
    }

    const identifier = resolveRowIdentifier(row);

    return (
        <aside className='plugin-sub-listing-detail' aria-label='Row detail'>
            <header className='plugin-sub-listing-detail__header'>
                <div className='plugin-sub-listing-detail__title'>
                    <span className='plugin-sub-listing-detail__eyebrow'>Record</span>
                    {identifier && (
                        <span className='plugin-sub-listing-detail__identifier' title={identifier}>
                            {identifier}
                        </span>
                    )}
                </div>
                <div className='plugin-sub-listing-detail__actions'>
                    <IconButton
                        size='sm'
                        variant='ghost'
                        onClick={handleCopy}
                        aria-label={copied ? 'Copied JSON' : 'Copy record as JSON'}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </IconButton>
                    <IconButton
                        size='sm'
                        variant='ghost'
                        onClick={onClose}
                        aria-label='Close detail panel'
                    >
                        <X size={14} />
                    </IconButton>
                </div>
            </header>
            <div className='plugin-sub-listing-detail__body'>
                {columns.map((column) => {
                    const key = getColumnKey(column);
                    const title = getColumnTitle(column);
                    const value = row[key];

                    return (
                        <section key={key} className='plugin-sub-listing-detail__field'>
                            <div className='plugin-sub-listing-detail__field-label'>
                                {title}
                            </div>
                            <div className='plugin-sub-listing-detail__field-value'>
                                {renderExpandedValue(value)}
                            </div>
                        </section>
                    );
                })}
            </div>
        </aside>
    );
};

export default SubListingDetailPanel;

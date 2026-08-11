import { getModelListingRoute } from './populated-model-routes';
import { isRecord } from '@/shared/utils/type-guards';
import { PopoverContent, PopoverDialog, PopoverRoot, PopoverTrigger } from '@heroui/react';
import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FC, MouseEvent, ReactNode } from 'react';

interface PopulatedCellPopoverProps {
    document: object | null;
    modelName: string;
    children: ReactNode;
    displayFields?: string[];
    labelMap?: Record<string, string>;
};

interface FieldEntry {
    key: string;
    label: string;
    value: string;
};

const numberFormatter = new Intl.NumberFormat();

const EXCLUDED_FIELDS = new Set([
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    'password',
    'passwordChangedAt',
    '__t'
]);



const resolveFieldValue = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return numberFormatter.format(value);
    if (typeof value === 'boolean') return value ? 'True' : 'False';

    if (Array.isArray(value)) {
        if (value.length === 0) return null;
        return `[${value.length} items]`;
    }

    if (isRecord(value)) {
        const obj = value;
        if (typeof obj.name === 'string') return obj.name;
        if (typeof obj._id === 'string') return obj._id;
        return null;
    }

    return null;
};

const formatFieldLabel = (key: string): string => {
    const spaced = key.replace(/([A-Z])/g, ' $1');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const PopulatedCellPopover: FC<PopulatedCellPopoverProps> = ({
    document: doc,
    modelName,
    children,
    displayFields,
    labelMap
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const listingRoute = getModelListingRoute(modelName);
    const documentRecord = useMemo<Record<string, unknown> | null>(() => {
        if (!isRecord(doc)) {
            return null;
        }

        return doc;
    }, [doc]);

    const fields = useMemo<FieldEntry[]>(() => {
        if (!documentRecord) return [];

        const keys = displayFields ?? Object.keys(documentRecord).filter((k) => !EXCLUDED_FIELDS.has(k));

        const entries: FieldEntry[] = [];
        for (const key of keys) {
            const raw = documentRecord[key];
            const value = resolveFieldValue(raw);
            if (value === null) continue;

            const label = labelMap?.[key] ?? formatFieldLabel(key);
            entries.push({
                key,
                label,
                value
            });
        }

        return entries;
    }, [displayFields, documentRecord, labelMap]);

    if (!documentRecord) {
        return <>{children}</>;
    }

    const handleStopPropagation = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const handleNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
        event.stopPropagation();
        setIsOpen(false);
    };

    const renderField = (field: FieldEntry) => {
        return (
            <div className='flex flex-row items-start gap-2 p-1 border-b border-border last:border-b-0' key={field.key}>
                <dt className='min-w-20 whitespace-nowrap text-xs text-muted'>{field.label}</dt>
                <dd className='m-0 flex-1 whitespace-normal wrap-anywhere text-xs text-foreground' title={field.value}>{field.value}</dd>
            </div>
        );
    };

    return (
        <div className='inline-flex' onClick={handleStopPropagation}>
            <PopoverRoot isOpen={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger<'button'>
                    type='button'
                    className='inline-flex cursor-pointer rounded-sm border-0 bg-transparent text-inherit no-underline [font:inherit] transition-colors duration-150 hover:underline hover:decoration-muted hover:underline-offset-2'
                    render={(triggerProps) => <button {...triggerProps} />}
                >
                    {children}
                </PopoverTrigger>
                <PopoverContent placement='bottom start' className='min-w-[180px] max-w-[320px]'>
                    <PopoverDialog aria-label={`${modelName} details`} className='p-0'>
                        <div className='flex flex-col'>
                            <div className='flex flex-row items-center justify-between gap-4 p-2 border-b border-border'>
                                <span className='text-xs text-muted'>{modelName}</span>
                                {listingRoute && (
                                    <nav aria-label={`${modelName} links`}>
                                        <Link
                                            to={listingRoute}
                                            className='flex items-center gap-1 whitespace-nowrap text-xs text-foreground no-underline transition-opacity duration-150 hover:opacity-80 [&_svg]:size-3.5'
                                            onClick={handleNavigate}
                                        >
                                            View in listing
                                            <ArrowUpRight />
                                        </Link>
                                    </nav>
                                )}
                            </div>
                            <div className='flex flex-col max-h-[240px] overflow-y-auto overscroll-contain'>
                                {fields.length > 0
                                    ? <dl className='m-0'>{fields.map(renderField)}</dl>
                                    : <span className='text-xs text-muted p-2'>No fields to display</span>
                                }
                            </div>
                        </div>
                    </PopoverDialog>
                </PopoverContent>
            </PopoverRoot>
        </div>
    );
};

export default PopulatedCellPopover;

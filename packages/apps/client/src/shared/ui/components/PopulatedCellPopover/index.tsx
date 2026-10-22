import { isRecord } from '@/shared/utils/type-guards';
import Scrollable from '@/shared/ui/components/Scrollable';
import { PopoverContent, PopoverDialog, PopoverRoot, PopoverTrigger } from '@heroui/react';
import { useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FC, MouseEvent, ReactNode } from 'react';

const populatedModelRoutes: Record<string, string> = {
    User: '/dashboard/my-team',
    TeamCluster: '/dashboard/clusters',
    Trajectory: '/dashboard/trajectories/list',
    Analysis: '/dashboard/analysis-configs/list',
    Plugin: '/dashboard/plugins/list',
    ScriptingNotebook: '/dashboard/notebooks',
    Whiteboard: '/dashboard/whiteboards',
    SecretKey: '/dashboard/settings/secret-keys'
};

const getModelListingRoute = (modelName: string): string | null => {
    return populatedModelRoutes[modelName] ?? null;
};

interface PopulatedCellPopoverProps {
    document: object | null;
    modelName: string;
    children: ReactNode;
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
    children
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

        const keys = Object.keys(documentRecord).filter((k) => !EXCLUDED_FIELDS.has(k));

        const entries: FieldEntry[] = [];
        for (const key of keys) {
            const raw = documentRecord[key];
            const value = resolveFieldValue(raw);
            if (value === null) continue;

            const label = formatFieldLabel(key);
            entries.push({
                key,
                label,
                value
            });
        }

        return entries;
    }, [documentRecord]);

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

    // The mockup's facts list: label and value in two columns, no rules between them.
    const renderField = (field: FieldEntry) => (
        <div className='contents' key={field.key}>
            <dt className='whitespace-nowrap text-muted'>{field.label}</dt>
            <dd className='m-0 min-w-0 wrap-anywhere tabular-nums text-foreground' title={field.value}>{field.value}</dd>
        </div>
    );

    return (
        <div className='inline-flex' onClick={handleStopPropagation}>
            <PopoverRoot isOpen={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger<'button'>
                    type='button'
                    className='inline-flex cursor-pointer rounded-sm border-0 bg-transparent p-0 text-inherit no-underline [font:inherit] transition-colors duration-150 hover:underline hover:decoration-muted hover:underline-offset-2'
                    render={(triggerProps) => <button {...triggerProps} />}
                >
                    {children}
                </PopoverTrigger>
                <PopoverContent placement='bottom start' className='min-w-56 max-w-80'>
                    <PopoverDialog aria-label={`${modelName} details`} className='p-1.5'>
                        <div className='flex flex-col'>
                            <div className='flex flex-row items-center justify-between gap-3 px-2.5 pt-2 pb-1.5'>
                                <span className='text-base font-medium text-foreground'>{modelName}</span>
                                {listingRoute && (
                                    <nav aria-label={`${modelName} links`}>
                                        <Link
                                            to={listingRoute}
                                            className='flex items-center gap-1 whitespace-nowrap text-sm text-muted no-underline transition-colors duration-150 hover:text-foreground [&_svg]:size-3.5'
                                            onClick={handleNavigate}
                                        >
                                            View in listing
                                            <ArrowUpRight />
                                        </Link>
                                    </nav>
                                )}
                            </div>
                            <Scrollable className='flex max-h-60 flex-col overscroll-contain px-2.5 pt-1 pb-2'>
                                {fields.length > 0
                                    ? <dl className='m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm'>{fields.map(renderField)}</dl>
                                    : <span className='text-sm text-muted'>No fields to display</span>
                                }
                            </Scrollable>
                        </div>
                    </PopoverDialog>
                </PopoverContent>
            </PopoverRoot>
        </div>
    );
};

export default PopulatedCellPopover;

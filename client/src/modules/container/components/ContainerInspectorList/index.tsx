import { cn } from '@heroui/react';
import type { ReactNode } from 'react';
import { KeyValueList, KeyValueRow } from '@voltstack/bravais';

export interface InspectorRow {
    label: string;
    value: ReactNode;
    copyValue?: string;
}

interface ContainerInspectorListProps {
    title?: string;
    rows: InspectorRow[];
    className?: string;
}

const ContainerInspectorList = ({ title, rows, className = '' }: ContainerInspectorListProps) => {
    if (rows.length === 0) {
        return null;
    }

    return (
        <div className={cn('flex flex-col', `container-inspector-list ${className}`)}>
            {title && (
                <h3 className='text-base font-medium text-foreground container-inspector-list-title'>
                    {title}
                </h3>
            )}
            <KeyValueList>
                {rows.map((row) => (
                    <KeyValueRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        copyValue={row.copyValue}
                    />
                ))}
            </KeyValueList>
        </div>
    );
};

export default ContainerInspectorList;

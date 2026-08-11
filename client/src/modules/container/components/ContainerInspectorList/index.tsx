import { cn } from '@heroui/react';
import type { ReactNode } from 'react';
import { ContainerKeyValueList, ContainerKeyValueRow } from '../ContainerKeyValueList';

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
        <div className={cn('flex flex-col', className)}>
            {title && (
                <h3 className='text-base font-medium text-foreground'>
                    {title}
                </h3>
            )}
            <ContainerKeyValueList>
                {rows.map((row) => (
                    <ContainerKeyValueRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        copyValue={row.copyValue}
                    />
                ))}
            </ContainerKeyValueList>
        </div>
    );
};

export default ContainerInspectorList;

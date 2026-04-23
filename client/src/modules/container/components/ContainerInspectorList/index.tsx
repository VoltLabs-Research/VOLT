import type { ReactNode } from 'react';
import { Stack, Heading, KeyValueList, KeyValueRow } from '@/shared/presentation/primitives';

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

const ContainerInspectorList = ({ title, rows, className = '' }: ContainerInspectorListProps) => {
    const visibleRows = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== '');

    if (visibleRows.length === 0) {
        return null;
    }

    return (
        <Stack className={`container-inspector-list ${className}`}>
            {title && (
                <Heading level={3} className='container-inspector-list-title'>
                    {title}
                </Heading>
            )}
            <KeyValueList>
                {visibleRows.map((row) => (
                    <KeyValueRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        copyValue={row.copyValue}
                    />
                ))}
            </KeyValueList>
        </Stack>
    );
};

export default ContainerInspectorList;

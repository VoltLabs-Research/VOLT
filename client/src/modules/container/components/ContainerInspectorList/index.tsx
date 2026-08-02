import type { ReactNode } from 'react';
import { Heading, KeyValueList, KeyValueRow, Stack } from '@voltstack/bravais';

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
        <Stack className={`container-inspector-list ${className}`}>
            {title && (
                <Heading level={3} className='container-inspector-list-title'>
                    {title}
                </Heading>
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
        </Stack>
    );
};

export default ContainerInspectorList;

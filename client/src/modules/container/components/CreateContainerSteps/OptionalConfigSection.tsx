import { CollapsibleSection, Tag } from '@voltstack/bravais';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface OptionalConfigSectionProps {
    title: string;
    description: string;
    defaultExpanded?: boolean;
    errorCount?: number;
    children: ReactNode;
}

/** Collapsible card for the optional parts of the container configuration step. */
const OptionalConfigSection = ({
    title,
    description,
    defaultExpanded = false,
    errorCount = 0,
    children
}: OptionalConfigSectionProps) => {
    const hasError = errorCount > 0;
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || hasError);

    return (
        <div className='flex flex-col gap-4 p-6 rounded-xl create-container-config-card full-width'>
            <CollapsibleSection
                title={title}
                expanded={isExpanded || hasError}
                onExpandedChange={setIsExpanded}
                useDefaultHeaderStyles={false}
                headerAction={hasError
                    ? (
                        <Tag tone='danger' size='xs' variant='soft'>
                            {`${errorCount} to fix`}
                        </Tag>
                    )
                    : undefined}
                bodyClassName='mt-3'
            >
                <div className='flex flex-col gap-4'>
                    <p className='text-sm text-muted'>{description}</p>
                    {children}
                </div>
            </CollapsibleSection>
        </div>
    );
};

export default OptionalConfigSection;

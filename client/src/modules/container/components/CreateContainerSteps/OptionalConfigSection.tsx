import { CollapsibleSection, Stack, Tag, Text } from '@voltstack/bravais';
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
        <Stack className='create-container-config-card full-width' radius='md' gap='1' p='1-5'>
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
                <Stack gap='1'>
                    <Text as='p' size='md' tone='muted'>{description}</Text>
                    {children}
                </Stack>
            </CollapsibleSection>
        </Stack>
    );
};

export default OptionalConfigSection;

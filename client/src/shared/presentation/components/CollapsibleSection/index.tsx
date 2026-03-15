import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Title from '@/shared/presentation/components/Title';
import './CollapsibleSection.css';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import { useState, useEffect, memo, useId } from 'react';
import type { MouseEvent, ReactNode } from 'react';

type CollapsibleSectionHeadingTag = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (next: boolean) => void;
    className?: string;
    headerClassName?: string;
    titleClassName?: string;
    iconClassName?: string;
    bodyClassName?: string;
    contentClassName?: string;
    noSpacing?: boolean;
    arrowSize?: number;
    useDefaultHeaderStyles?: boolean;
    useDefaultTitleStyles?: boolean;
    onDelete?: () => void;
    deleteActionLabel?: string;
    deleteActionAlwaysVisible?: boolean;
    onAdd?: () => void;
    icon?: ReactNode;
    headerAction?: ReactNode;
    collapsible?: boolean;
    titleAs?: CollapsibleSectionHeadingTag;
};

const CollapsibleSection = ({
    title,
    children,
    defaultExpanded = false,
    expanded,
    onExpandedChange,
    className = '',
    headerClassName = '',
    titleClassName = '',
    iconClassName = '',
    bodyClassName = '',
    contentClassName = '',
    noSpacing = false,
    arrowSize = 20,
    useDefaultHeaderStyles = true,
    useDefaultTitleStyles = true,
    onDelete,
    deleteActionLabel = 'Delete section',
    deleteActionAlwaysVisible = false,
    onAdd,
    icon,
    headerAction,
    collapsible = true,
    titleAs = 'h3'
}: CollapsibleSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [hasBeenExpanded, setHasBeenExpanded] = useState(defaultExpanded);
    const [height, setHeight] = useState<number | 'auto'>(defaultExpanded ? 'auto' : 0);
    const reactId = useId();
    const isControlled = typeof expanded === 'boolean';
    const actualExpanded = isControlled ? expanded : isExpanded;
    const headerBaseClass = useDefaultHeaderStyles ? 'collapsible-section-header' : '';
    const titleBaseClass = useDefaultTitleStyles ? 'collapsible-section-title font-size-3 font-weight-6 color-primary' : 'collapsible-section-title';
    const bodyId = `collapsible-section-body-${reactId}`;
    const headingId = `collapsible-section-heading-${reactId}`;
    const triggerId = `collapsible-section-trigger-${reactId}`;

    useEffect(() => {
        if (actualExpanded && !hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
    }, [actualExpanded, hasBeenExpanded]);

    useEffect(() => {
        setHeight(actualExpanded ? 'auto' : 0);
    }, [actualExpanded]);

    const handleToggle = () => {
        if (!collapsible) return;
        const next = !actualExpanded;
        if (isControlled) {
            onExpandedChange?.(next);
            return;
        }
        setIsExpanded(next);
    };

    const handleDelete = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onDelete?.();
    };

    const handleAdd = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onAdd?.();
    };

    const actions = (
        <Container className='d-flex items-center gap-025 collapsible-section-actions'>
            {headerAction}
            {onAdd && (
                <IconButton
                    size='sm'
                    variant='ghost'
                    onClick={handleAdd}
                    className='collapsible-section-action--add'
                    title='Add item'
                >
                    <Plus size={16} />
                </IconButton>
            )}
            {onDelete && (
                <IconButton
                    size='sm'
                    variant='ghost'
                    onClick={handleDelete}
                    className={`collapsible-section-action--delete ${deleteActionAlwaysVisible ? 'collapsible-section-action--delete-visible' : ''}`}
                    title={deleteActionLabel}
                    aria-label={deleteActionLabel}
                >
                    <Trash2 size={16} />
                </IconButton>
            )}
        </Container>
    );

    return (
        <Container className={`d-flex column ${noSpacing ? '' : 'mb-1-5'} ${className}`}>
            <Container className={`${headerBaseClass} d-flex content-between items-center gap-05 ${headerClassName}`}>
                <Title as={titleAs} id={headingId} className='collapsible-section-heading'>
                    {collapsible ? (
                        <Container className='collapsible-section-header-row d-flex items-center gap-05'>
                            <button
                                id={triggerId}
                                type='button'
                                className='collapsible-section-trigger d-flex items-center gap-05 u-select-none'
                                onClick={handleToggle}
                                aria-expanded={actualExpanded}
                                aria-controls={bodyId}
                            >
                                <Container className='collapsible-section-trigger-content d-flex items-center gap-05'>
                                    {icon && <span className={`d-flex items-center ${iconClassName}`}>{icon}</span>}
                                    <span className={`${titleBaseClass} ${titleClassName}`}>{title}</span>
                                </Container>
                            </button>
                            {actions}
                            <button
                                type='button'
                                className='collapsible-section-chevron-trigger d-flex flex-center color-muted'
                                onClick={handleToggle}
                                aria-expanded={actualExpanded}
                                aria-controls={bodyId}
                                aria-label={`${actualExpanded ? 'Collapse' : 'Expand'} ${title}`}
                            >
                                <Container
                                    className={`collapsible-section-arrow d-flex flex-center ${!actualExpanded ? 'collapsible-section-arrow--collapsed' : ''}`}
                                    aria-hidden='true'
                                >
                                    <ChevronDown size={arrowSize} />
                                </Container>
                            </button>
                        </Container>
                    ) : (
                        <Container className='d-flex items-center gap-05 collapsible-section-title-row'>
                            <Container className='collapsible-section-trigger-content d-flex items-center gap-05'>
                                {icon && <span className={`d-flex items-center ${iconClassName}`}>{icon}</span>}
                                <span className={`${titleBaseClass} ${titleClassName}`}>{title}</span>
                            </Container>
                            {actions}
                        </Container>
                    )}
                </Title>
            </Container>
            {collapsible && (
                <div
                    id={bodyId}
                    className={`collapsible-section-body ${bodyClassName}`}
                    style={{ height }}
                    role='region'
                    aria-labelledby={triggerId}
                >
                    <Container className={`collapsible-section-content d-flex column ${contentClassName}`}>
                        {hasBeenExpanded ? children : null}
                    </Container>
                </div>
            )}

            {!collapsible && (
                <Container id={bodyId} className={`collapsible-section-body collapsible-section-body--static ${bodyClassName}`} role='region' aria-labelledby={headingId}>
                    <Container className={`collapsible-section-content d-flex column ${contentClassName}`}>
                        {children}
                    </Container>
                </Container>
            )}
        </Container>
    );
};

export default memo(CollapsibleSection);

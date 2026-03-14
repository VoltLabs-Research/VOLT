import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Title from '@/shared/presentation/components/Title';
import './CollapsibleSection.css';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import { useState, useEffect, memo, useId } from 'react';
import type { ReactNode } from 'react';

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
    onAdd?: () => void;
    icon?: ReactNode;
    headerAction?: ReactNode;
    collapsible?: boolean;
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
    onAdd,
    icon,
    headerAction,
    collapsible = true
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

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAdd?.();
    };

    return (
        <Container className={`d-flex column ${noSpacing ? '' : 'mb-1-5'} ${className}`}>
            <Container className={`${headerBaseClass} d-flex content-between items-center gap-05 ${headerClassName}`}>
                <button
                    type='button'
                    className='collapsible-section-trigger d-flex items-center content-between gap-05 u-select-none'
                    onClick={handleToggle}
                    aria-expanded={collapsible ? actualExpanded : undefined}
                    aria-controls={collapsible ? bodyId : undefined}
                    disabled={!collapsible}
                >
                    <Container className='d-flex items-center gap-05'>
                        {icon && <span className={`d-flex items-center ${iconClassName}`}>{icon}</span>}
                        <Title className={`${titleBaseClass} ${titleClassName}`}>{title}</Title>
                    </Container>
                    {collapsible && (
                        <Container
                            className={`collapsible-section-arrow d-flex flex-center color-muted ${!actualExpanded ? 'collapsible-section-arrow--collapsed' : ''}`}
                        >
                            <ChevronDown size={arrowSize} />
                        </Container>
                    )}
                </button>

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
                            className='collapsible-section-action--delete'
                            title='Delete section'
                        >
                            <Trash2 size={16} />
                        </IconButton>
                    )}
                </Container>
            </Container>
            {collapsible && (
                <div
                    id={bodyId}
                    className={`collapsible-section-body ${bodyClassName}`}
                    style={{ height }}
                    role='region'
                >
                    <Container className={`collapsible-section-content d-flex column ${contentClassName}`}>
                        {hasBeenExpanded ? children : null}
                    </Container>
                </div>
            )}

            {!collapsible && (
                <Container id={bodyId} className={`collapsible-section-body collapsible-section-body--static ${bodyClassName}`} role='region'>
                    <Container className={`collapsible-section-content d-flex column ${contentClassName}`}>
                        {children}
                    </Container>
                </Container>
            )}
        </Container>
    );
};

export default memo(CollapsibleSection);

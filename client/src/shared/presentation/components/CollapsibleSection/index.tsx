import { useState, useRef, useEffect, type ReactNode, memo } from 'react';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import IconButton from '@/shared/presentation/components/IconButton';
import './CollapsibleSection.css';

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
    icon
}: CollapsibleSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isHovered, setIsHovered] = useState(false);
    const [hasBeenExpanded, setHasBeenExpanded] = useState(defaultExpanded);
    const bodyRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | 'auto'>(defaultExpanded ? 'auto' : 0);
    const isControlled = typeof expanded === 'boolean';
    const actualExpanded = isControlled ? expanded : isExpanded;
    const headerBaseClass = useDefaultHeaderStyles ? 'collapsible-section-header' : '';
    const titleBaseClass = useDefaultTitleStyles ? 'collapsible-section-title font-size-3 font-weight-6 color-primary' : 'collapsible-section-title';

    useEffect(() => {
        if (actualExpanded && !hasBeenExpanded) {
            setHasBeenExpanded(true);
        }
    }, [actualExpanded, hasBeenExpanded]);

    useEffect(() => {
        if (!bodyRef.current) return;

        if (actualExpanded) {
            const scrollHeight = bodyRef.current.scrollHeight;
            setHeight(scrollHeight);
            const timer = setTimeout(() => setHeight('auto'), 250);
            return () => clearTimeout(timer);
        } else {
            const scrollHeight = bodyRef.current.scrollHeight;
            setHeight(scrollHeight);
            requestAnimationFrame(() => {
                setHeight(0);
            });
        }
    }, [actualExpanded]);

    const handleToggle = () => {
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
            <Container
                className={`${headerBaseClass} d-flex content-between items-center cursor-pointer u-select-none ${headerClassName}`}
                onClick={handleToggle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <Container className='d-flex items-center gap-05'>
                    {icon && <span className={`d-flex items-center ${iconClassName}`}>{icon}</span>}
                    <Title className={`${titleBaseClass} ${titleClassName}`}>{title}</Title>
                </Container>
                <Container className='d-flex items-center gap-025'>
                    {onAdd && (
                        <IconButton
                            size='sm'
                            variant='ghost'
                            onClick={handleAdd}
                            className='collapsible-section-action--add'
                        >
                            <Plus size={16} />
                        </IconButton>
                    )}
                    {onDelete && isHovered && (
                        <IconButton
                            size='sm'
                            variant='ghost'
                            onClick={handleDelete}
                            className='collapsible-section-action--delete'
                        >
                            <Trash2 size={16} />
                        </IconButton>
                    )}
                    <Container
                        className={`collapsible-section-arrow d-flex flex-center color-muted ${!actualExpanded ? 'collapsible-section-arrow--collapsed' : ''}`}
                    >
                        <ChevronDown size={arrowSize} />
                    </Container>
                </Container>
            </Container>
            <div
                ref={bodyRef}
                className={`collapsible-section-body ${bodyClassName}`}
                style={{ height }}
            >
                <Container className={`collapsible-section-content d-flex column ${contentClassName}`}>
                    {hasBeenExpanded ? children : null}
                </Container>
            </div>
        </Container>
    );
};

export default memo(CollapsibleSection);

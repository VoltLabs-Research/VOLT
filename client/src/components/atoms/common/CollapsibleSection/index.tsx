import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ChevronDown, Trash2, Plus } from 'lucide-react';
import '@/components/atoms/common/CollapsibleSection/CollapsibleSection.css';
import Title from '@/components/primitives/Title';
import Container from '@/components/primitives/Container';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  onDelete?: () => void;
  onAdd?: () => void;
  icon?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
  className = '',
  onDelete,
  onAdd
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bodyRef.current || !arrowRef.current) return;

    const bodyElement = bodyRef.current;
    const arrowElement = arrowRef.current;

    if (isExpanded) {
      // Simple expand animation
      gsap.set(bodyElement, { height: 'auto' });
      const height = bodyElement.offsetHeight;
      gsap.set(bodyElement, { height: 0 });

      gsap.to(bodyElement, {
        height: height,
        duration: 0.25,
        ease: 'power2.out',
        onComplete: () => {
          gsap.set(bodyElement, { height: 'auto' });
        }
      });

      gsap.to(arrowElement, {
        rotation: 0,
        duration: 0.25,
        ease: 'power2.out'
      });
    } else {
      // Simple collapse animation
      const height = bodyElement.offsetHeight;
      gsap.set(bodyElement, { height: height });

      gsap.to(bodyElement, {
        height: 0,
        duration: 0.25,
        ease: 'power2.in'
      });

      gsap.to(arrowElement, {
        rotation: -90,
        duration: 0.25,
        ease: 'power2.out'
      });
    }
  }, [isExpanded]);

  // Set initial state for collapsed sections
  useEffect(() => {
    if (!isExpanded && bodyRef.current) {
      gsap.set(bodyRef.current, { height: 0 });
    }
  }, []);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
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
    <Container className={`d-flex column mb-1-5 ${className}`}>
      <Container
        className="d-flex content-between items-center cursor-pointer editor-sidebar-item-header-container"
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      >
        <Title className="font-size-3 font-weight-6 color-primary u-select-none">{title}</Title>
        <Container className="d-flex items-center gap-025">
          {onAdd && (
            <Container
              onClick={handleAdd}
              style={{
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-green, #4ade80)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
              }}
            >
              <Plus size={16} />
            </Container>
          )}
          {onDelete && isHovered && (
            <Container
              onClick={handleDelete}
              style={{
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-red, #ff6b6b)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
              }}
            >
              <Trash2 size={16} />
            </Container>
          )}
          <Container
            ref={arrowRef}
            className="d-flex flex-center editor-sidebar-item-arrow color-muted"
          >
            <ChevronDown size={20} />
          </Container>
        </Container>
      </Container>
      <Container
        ref={bodyRef}
        className="editor-sidebar-item-body-container d-flex column gap-1"
        style={{ overflow: 'hidden' }}
      >
        {children}
      </Container>
    </Container>
  );
};

export default CollapsibleSection;

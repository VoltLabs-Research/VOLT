import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { MdKeyboardArrowDown } from 'react-icons/md';
import './CollapsibleSection.css';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
  className = '',
  icon
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
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

  return (
    <div className={`editor-sidebar-item-container ${className}`}>
      <div 
        className="editor-sidebar-item-header-container"
        onClick={handleToggle}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && <div style={{ display: 'flex', alignItems: 'center' }}>{icon}</div>}
          <h3 className="editor-sidebar-item-header-title">{title}</h3>
        </div>
        <div 
          ref={arrowRef}
          className="editor-sidebar-item-arrow"
        >
          <MdKeyboardArrowDown size={20} />
        </div>
      </div>
      <div 
        ref={bodyRef}
        className="editor-sidebar-item-body-container"
        style={{ overflow: 'hidden' }}
      >
        {children}
      </div>
    </div>
  );
};

export default CollapsibleSection;

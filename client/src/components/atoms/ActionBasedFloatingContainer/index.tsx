import { useEffect, useState, useRef } from 'react';
import './ActionBasedFloatingContainer.css';

const ActionBasedFloatingContainer = ({ options, children }: any) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [offset, setOffset] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const handleOnClick = () => {
        if(!containerRef.current) return;
        const { top, height } = containerRef.current.getBoundingClientRect();
        const marginTop = 20;
        const finalOffset = top + height + marginTop;
        setOffset(finalOffset);
        setIsVisible(!isVisible);
    };

    useEffect(() => {
        const handleDocumentOnClick = (event: MouseEvent) => {
            if(containerRef.current && !containerRef.current.contains(event.target as Node)){
                setIsVisible(false);
            }
        };

        document.addEventListener('click', handleDocumentOnClick);

        return () => {
            document.removeEventListener('click', handleDocumentOnClick);
        };
    }, []);

    return (
        <>
            <div
                onClick={handleOnClick}
                ref={containerRef}
                className='action-based-floating-container-element-wrapper'
            >
                {children}
            </div>

            {isVisible && (
                <div 
                    style={{ top: `${offset}px` }}
                    className='action-based-floating-container'
                >
                    {options.map(([ name, Icon, onClick ], index) => (
                        <div className='action-based-floating-option-container' key={index} onClick={onClick}>
                            <i className='action-based-floating-option-icon-container'>
                                <Icon />
                            </i>

                            <span className='action-based-floating-option-name-container'>
                                {name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default ActionBasedFloatingContainer;
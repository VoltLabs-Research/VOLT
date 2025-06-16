import { useState, useEffect } from 'react';

const useInputStates = () => {
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [isShiftPressed, setIsShiftPressed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if(event.key === 'Control'){
                setIsCtrlPressed(true);
            }

            if(event.key === 'Shift'){
                setIsShiftPressed(true);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if(event.key === 'Control'){
                setIsCtrlPressed(false);
            }

            if(event.key === 'Shift'){
                setIsShiftPressed(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);    
        };
    }, []);

    return { isCtrlPressed, isShiftPressed };
};

export default useInputStates;
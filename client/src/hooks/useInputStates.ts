import { useState, useEffect } from 'react';

const useInputStates = () => {
    const [ctrlPressed, setCtrlPressed] = useState(false);
    const [shiftPressed, setShiftPressed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if(event.key === 'Control'){
                setCtrlPressed(true);
            }
            if(event.key === 'Shift'){
                setShiftPressed(true);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if(event.key === 'Control'){
                setCtrlPressed(false);
            }
            if(event.key === 'Shift'){
                setShiftPressed(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return { ctrlPressed, shiftPressed };
};

export default useInputStates;
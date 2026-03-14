import { useState } from 'react';

/**
 * Hook for managing chat UI state (panels, modals, etc.).
 */
const useChatUIState = () => {
    const [showDetails, setShowDetails] = useState(false);

    const toggleDetails = () => setShowDetails((prev) => !prev);
    const openDetails = () => setShowDetails(true);
    const closeDetails = () => setShowDetails(false);

    return {
        showDetails,
        setShowDetails,
        toggleDetails,
        openDetails,
        closeDetails
    };
};

export default useChatUIState;

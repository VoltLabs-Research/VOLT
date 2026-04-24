import { useState } from 'react';

/**
 * Hook for managing chat UI state (panels, modals, etc.).
 */
const useChatUIState = () => {
    const [showDetails, setShowDetails] = useState(false);

    const toggleDetails = () => setShowDetails((prev) => !prev);
    const closeDetails = () => setShowDetails(false);

    return {
        showDetails,
        toggleDetails,
        closeDetails
    };
};

export default useChatUIState;

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
/**
 * Hook for chat navigation actions.
 * Handles selecting chats by navigating to their routes.
 */
const useChatNavigation = () => {
    const navigate = useNavigate();

    const handleSelectChat = useCallback((chatId: string) => {
        navigate(`/dashboard/messages/${chatId}`);
    }, [navigate]);

    const navigateToMessages = useCallback(() => {
        navigate('/dashboard/messages');
    }, [navigate]);

    return {
        handleSelectChat,
        navigateToMessages
    };
};

export default useChatNavigation;

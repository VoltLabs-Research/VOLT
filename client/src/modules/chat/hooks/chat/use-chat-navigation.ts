import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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

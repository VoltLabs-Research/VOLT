import { useGetOrCreateChatMutation, addChatToCache } from './queries';
import { runAction } from '@/shared/ui/actions/run-action';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { useNavigate } from 'react-router-dom';

const useChatActions = () => {
    const navigate = useNavigate();
    const getOrCreateChatMutationResult = useGetOrCreateChatMutation();

    const getOrCreateChat = async (teamId: string, participantId: string) => {
        return runAction({
            action: () => getOrCreateChatMutationResult.mutateAsync({
                teamId,
                participantId
            }),
            toast: createPromiseToastOptions({
                loading: 'Opening chat...',
                success: 'Chat ready',
                error: 'Failed to open chat'
            }),
            afterSuccess: (chat) => {
                addChatToCache(chat);
                navigate(`/dashboard/messages/${chat._id}`);
            }
        });
    };

    return {
        getOrCreateChat
    };
};

export default useChatActions;

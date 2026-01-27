import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatRepository } from '../../infrastructure/repositories/ChatRepository';
import type { Chat } from '../../domain/entities';

export const chatQueryKeys = {
    all: ['chats'] as const,
    detail: (chatId: string) => ['chats', 'detail', chatId] as const,
    messages: (chatId: string) => ['chats', 'messages', chatId] as const,
    teamMembers: (teamId: string) => ['chats', 'team-members', teamId] as const,
};

export const useChats = () => {
    return useQuery({
        queryKey: chatQueryKeys.all,
        queryFn: () => chatRepository.getChats(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useChatMessages = (chatId: string | null) => {
    return useInfiniteQuery({
        queryKey: chatQueryKeys.messages(chatId!),
        queryFn: ({ pageParam = 1 }) => chatRepository.getChatMessages(chatId!, pageParam),
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 50 ? allPages.length + 1 : undefined;
        },
        enabled: !!chatId,
    });
};

export const useTeamMembers = (teamId: string | null) => {
    return useQuery({
        queryKey: chatQueryKeys.teamMembers(teamId!),
        queryFn: () => chatRepository.getTeamMembers(teamId!),
        enabled: !!teamId,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const useChatMutations = () => {
    const queryClient = useQueryClient();

    const sendMessage = useMutation({
        mutationFn: ({ chatId, content, messageType, metadata }: { chatId: string, content: string, messageType?: string, metadata?: any }) => 
            chatRepository.sendMessage(chatId, content, messageType, metadata),
        onSuccess: (newMessage, { chatId }) => {
            // Optimistic update or invalidation could go here
            // But we largely rely on sockets for real-time
            // We can invalidate to be safe
            // queryClient.invalidateQueries({ queryKey: chatQueryKeys.messages(chatId) });
        }
    });

    return {
        sendMessage
    };
};

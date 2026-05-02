import Box from '@/shared/presentation/primitives/Box';
import Row from '@/shared/presentation/primitives/Row';
import Text from '@/shared/presentation/primitives/Text';
import ThinkingDots from '@/shared/presentation/primitives/ThinkingDots';
import './TypingIndicator.css';
import type { TypingUser } from '@/modules/chat/api/entities/shared/chat-events';

interface TypingIndicatorProps {
    users: TypingUser[];
}

const TypingIndicator = ({ users }: TypingIndicatorProps) => {
    const typingUsers = users.filter((u) => u.isTyping);

    if (typingUsers.length === 0) return null;

    const names = typingUsers.map((u) => u.userName).join(', ');
    const message = `${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing…`;

    return (
        <Box display='flex' gap='05' mb='3' role='status' aria-live='polite' aria-atomic='true'>
            <Row gap='05' className='chat-typing-indicator'>
                <ThinkingDots size='sm' label={message} />
                <Text as='p' size='md' tone='muted'>
                    {message}
                </Text>
            </Row>
        </Box>
    );
};

export default TypingIndicator;

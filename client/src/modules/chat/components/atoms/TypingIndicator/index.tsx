import './TypingIndicator.css';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import type { TypingUser } from '@/modules/chat/api/entities/shared/chat-events';

interface TypingIndicatorProps {
    users: TypingUser[];
};

const TypingIndicator = ({ users }: TypingIndicatorProps) => {
    const typingUsers = users.filter((u) => u.isTyping);

    if (typingUsers.length === 0) return null;

    const names = typingUsers.map((u) => u.userName).join(', ');
    const message = `${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing…`;

    return (
        <Container className='d-flex gap-05 mb-3' role='status' aria-live='polite' aria-atomic='true'>
            <Container className='d-flex items-center gap-05 chat-typing-indicator'>
                <Container className='d-flex gap-025' aria-hidden='true'>
                    <Container className='chat-typing-dot' />
                    <Container className='chat-typing-dot' />
                    <Container className='chat-typing-dot' />
                </Container>
                <Paragraph className='font-size-2 color-muted'>
                    {message}
                </Paragraph>
            </Container>
        </Container>
    );
};

export default TypingIndicator;

import './TypingIndicator.css';
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
        <div className='volt-container d-flex gap-05 mb-3' role='status' aria-live='polite' aria-atomic='true'>
            <div className='volt-container d-flex items-center gap-05 chat-typing-indicator'>
                <div className='volt-container d-flex gap-025' aria-hidden='true'>
                    <div className='volt-container chat-typing-dot' />
                    <div className='volt-container chat-typing-dot' />
                    <div className='volt-container chat-typing-dot' />
                </div>
                <p className='volt-text font-size-2 color-muted'>
                    {message}
                </p>
            </div>
        </div>
    );
};

export default TypingIndicator;

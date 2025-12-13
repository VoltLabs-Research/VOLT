type TypingIndicator = {
    users: { userName: string }[]
};

const TypingIndicator = ({ users }: TypingIndicator) => {
    if(!users.length) return null;

      return(
        <div className='chat-message received'>
            <div className='chat-typing-indicator'>
                <div className='chat-typing-dots'>
                    <div className='chat-typing-dot'></div>
                    <div className='chat-typing-dot'></div>
                    <div className='chat-typing-dot'></div>
                </div>
                <span className='chat-typing-text'>
                    {users.map(u => u.userName).join(', ')} typing...
                </span>
            </div>
        </div>
    );
};

export default TypingIndicator;

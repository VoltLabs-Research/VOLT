type WelcomeEmptyProps = {
    isConnected: boolean
};

const WelcomeEmpty = ({ isConnected }: WelcomeEmptyProps) => {
    return(
        <div className='chat-welcome-container'>
            <div className='chat-welcome-content'>
                <h2>Welcome to Chat</h2>
                <p>Select a conversation or start a new chat with a team member</p>
                {!isConnected && (
                    <div className='chat-connection-status'>
                        <p>Connecting to chat service...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WelcomeEmpty;

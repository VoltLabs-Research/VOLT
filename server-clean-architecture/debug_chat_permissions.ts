
import { Types } from 'mongoose';

// Mock the ChatMessage entity class locally to replicate the logic exactly
export enum ChatMessageType {
    Text = 'text',
    File = 'file',
    System = 'system'
};

export interface ChatMessageMetadata {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    filePath: string;
};

export interface ChatReaction {
    emoji: string;
    users: string[];
};

export interface ChatMessageProps {
    chat: string;
    sender: any;
    content: string;
    messageType: ChatMessageType;
    isRead: boolean;
    readBy: string[];
    metadata: ChatMessageMetadata;
    editedAt: Date;
    deleted: boolean;
    deletedAt: Date;
    deletedBy: string;
    reactions: ChatReaction[];
    createdAt: Date;
    updatedAt: Date;
};

class ChatMessage {
    constructor(
        public id: string,
        public props: ChatMessageProps
    ) { }

    public isSender(userId: string): boolean {
        // EXACT COPY OF THE LOGIC IN ChatMessage.ts
        const senderId = typeof this.props.sender === 'string'
            ? this.props.sender
            : this.props.sender._id?.toString() || this.props.sender.id?.toString() || this.props.sender.toString();

        return senderId === userId;
    }

    public toggleReaction(userId: string, emoji: string): void {
        // EXACT COPY OF THE LOGIC IN ChatMessage.ts
        for (let i = this.props.reactions.length - 1; i >= 0; i--) {
            const reaction = this.props.reactions[i];
            const userIndex = reaction.users.indexOf(userId);

            if (userIndex !== -1) {
                reaction.users.splice(userIndex, 1);
                if (reaction.users.length === 0) {
                    this.props.reactions.splice(i, 1);
                }
                if (reaction.emoji === emoji) {
                    return;
                }
            }
        }

        const existingReactionIndex = this.props.reactions.findIndex((r) => r.emoji === emoji);

        if (existingReactionIndex !== -1) {
            this.props.reactions[existingReactionIndex].users.push(userId);
        } else {
            this.props.reactions.push({
                emoji,
                users: [userId]
            });
        }
    }
};

async function runTests() {
    console.log('--- TEST START ---');
    const userId = '609b1d3f9f1b2c001f8e4c1a'; // Simulated User ID
    const otherUserId = '609b1d3f9f1b2c001f8e4c1b';

    // TEST 1: isSender with String ID (unpopulated, mapped by BaseMapper?)
    const msgString = new ChatMessage('msg1', { sender: userId, reactions: [] } as any);
    console.log('Test 1 (String Sender):', msgString.isSender(userId) ? 'PASS' : 'FAIL');

    // TEST 2: isSender with Mongoose ObjectId (unpopulated, raw from DB)
    const objectId = new Types.ObjectId(userId);
    const msgObjectId = new ChatMessage('msg2', { sender: objectId, reactions: [] } as any);

    // Debugging what happens inside
    const senderIdExtracted = typeof msgObjectId.props.sender === 'string'
        ? msgObjectId.props.sender
        : msgObjectId.props.sender._id?.toString() || msgObjectId.props.sender.id?.toString() || msgObjectId.props.sender.toString();
    console.log('Test 2 Debug (Extracted ID):', senderIdExtracted);
    console.log('Test 2 (ObjectId Sender):', msgObjectId.isSender(userId) ? 'PASS' : 'FAIL');

    // TEST 3: isSender with Populated User Object (with _id as ObjectId)
    const userObj = { _id: new Types.ObjectId(userId), firstName: 'John' };
    const msgPopulated = new ChatMessage('msg3', { sender: userObj, reactions: [] } as any);
    console.log('Test 3 (Populated User ObjectId):', msgPopulated.isSender(userId) ? 'PASS' : 'FAIL');

    // TEST 4: isSender with Populated User Object (with _id as String)
    const userObjStr = { _id: userId, firstName: 'John' };
    const msgPopulatedStr = new ChatMessage('msg4', { sender: userObjStr, reactions: [] } as any);
    console.log('Test 4 (Populated User String):', msgPopulatedStr.isSender(userId) ? 'PASS' : 'FAIL');

    // TEST 5: Exclusive Reactions
    const msgReaction = new ChatMessage('msg5', {
        reactions: [{ emoji: '👍', users: [userId] }]
    } as any);

    // Toggle same (should remove)
    msgReaction.toggleReaction(userId, '👍');
    console.log('Test 5a (Toggle Remove):', msgReaction.props.reactions.length === 0 ? 'PASS' : 'FAIL');

    // Add new (should add)
    msgReaction.toggleReaction(userId, '❤️');
    console.log('Test 5b (Add New):',
        msgReaction.props.reactions.length === 1 && msgReaction.props.reactions[0].emoji === '❤️'
            ? 'PASS' : 'FAIL');

    // Switch reaction (should remove Heart and add Laugh)
    msgReaction.toggleReaction(userId, '😂');
    console.log('Test 5c (Switch Exclusive):',
        msgReaction.props.reactions.length === 1 && msgReaction.props.reactions[0].emoji === '😂'
            ? 'PASS' : 'FAIL');

    console.log('--- TEST END ---');
}

runTests().catch(console.error);

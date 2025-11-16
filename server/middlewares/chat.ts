import { Team, Chat, Message } from '@/models';
import { NextFunction, Request, Response } from 'express';

export const verifyTeamAccess = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const user = (req as any).user;
        const { teamId } = req.params;

        const team = await Team.findOne({
            _id: teamId,
            $or: [
                { owner: user._id },
                { members: user._id }
            ]
        });

        if(!team){
            return res.status(404).json({ status: 'error', message: 'Team::NotFound' });
        }

        (req as any).team = team;
        next();
    }catch(err){
        next(err);
    }
};

export const verifyChatAccess = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const user = (req as any).user;
        const { chatId } = req.params;

        // Verify user has access to this chat (TODO: MAYBE A MIDDLEWARE FOR THIS???)
        // For direct chats, allow access even if not active.
        // For group chats, only allow if active.
        const chat = await Chat.findOne({
            _id: chatId,
            participants: user._id,
            $or: [
                { isGroup: false },
                { isGroup: true, isActive: true }
            ]
        });

        if(!chat){
            return res.status(404).json({ status: 'error', message: 'Chat::NotFound' });
        }

        (req as any).chat = chat;
        next();
    }catch(err){
        next(err);
    }
};

export const verifyParticipantInTeam = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const { teamId, participantId } = req.params;

        const exists = await Team.findOne({
            _id: teamId,
            $or: [{ owner: participantId }, { members: participantId }]
        });

        if(!exists){
            return res.status(403).json({ status: 'error', message: 'Participant::NotFound' });
        }
        
        next();
    }catch(err){
        next(err);
    }
};

export const loadMessage = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const { messageId, chatId } = req.params;
        const message = await Message.findOne({ _id: messageId, chat: chatId });

        if(!message){
            return res.status(404).json({ status: 'error', message: 'Message::NotFound' });
        }
        
        (req as any).message = message;
        next();
    }catch(err){
        next(err);
    }
};

export const requireMessageOwner = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const message = (req as any).message;

    if(message.sender.toString() !== user._id.toString()){
        return res.status(403).json({
            status: 'error', 
            message: 'Message::Forbidden' 
        });
    }

    next();
};
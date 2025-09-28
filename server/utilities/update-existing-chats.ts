/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import mongoose from 'mongoose';

export async function updateExistingChats() {
    try {
        const db = mongoose.connection.db;
        const chatsCollection = db.collection('chats');
        
        console.log('[UpdateExistingChats] Starting update of existing chats...');
        
        // Find all chats that don't have the isGroup field or have it as undefined
        const chatsToUpdate = await chatsCollection.find({
            $or: [
                { isGroup: { $exists: false } },
                { isGroup: null },
                { isGroup: undefined }
            ]
        }).toArray();
        
        console.log(`[UpdateExistingChats] Found ${chatsToUpdate.length} chats to update`);
        
        if (chatsToUpdate.length > 0) {
            // Update all chats to set isGroup: false (individual chats)
            const result = await chatsCollection.updateMany(
                {
                    $or: [
                        { isGroup: { $exists: false } },
                        { isGroup: null },
                        { isGroup: undefined }
                    ]
                },
                {
                    $set: {
                        isGroup: false
                    }
                }
            );
            
            console.log(`[UpdateExistingChats] ✅ Updated ${result.modifiedCount} chats to set isGroup: false`);
        } else {
            console.log('[UpdateExistingChats] No chats need updating');
        }
        
        // Verify the update
        const updatedChats = await chatsCollection.find({ isGroup: false }).count();
        const groupChats = await chatsCollection.find({ isGroup: true }).count();
        
        console.log(`[UpdateExistingChats] ✅ Verification: ${updatedChats} individual chats, ${groupChats} group chats`);
        console.log('[UpdateExistingChats] ✅ Database update completed successfully');
        
    } catch (error) {
        console.error('[UpdateExistingChats] Error updating chats:', error);
    }
}

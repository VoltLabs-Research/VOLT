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

export async function fixChatIndex() {
    try {
        const db = mongoose.connection.db;
        const chatsCollection = db.collection('chats');
        
        // Get all indexes
        const indexes = await chatsCollection.indexes();
        console.log('[FixChatIndex] Current indexes:', indexes.map(idx => ({ name: idx.name, unique: idx.unique })));
        
        // Find the problematic unique index
        const problematicIndex = indexes.find(idx => 
            idx.name === 'participants_1_team_1' && idx.unique === true
        );
        
        if (problematicIndex) {
            console.log('[FixChatIndex] Found problematic unique index, removing...');
            try {
                await chatsCollection.dropIndex(problematicIndex.name);
                console.log('[FixChatIndex] ✅ Removed unique index:', problematicIndex.name);
                
                // Create new non-unique index
                await chatsCollection.createIndex(
                    { participants: 1, team: 1 }, 
                    { unique: false, name: 'participants_1_team_1' }
                );
                console.log('[FixChatIndex] ✅ Created new non-unique index');
                
            } catch (error: any) {
                if (error.code === 27) {
                    // Index doesn't exist, that's fine
                    console.log('[FixChatIndex] Index already removed or doesn\'t exist');
                } else {
                    console.error('[FixChatIndex] Error removing index:', error);
                }
            }
        } else {
            console.log('[FixChatIndex] No problematic unique index found');
        }
        
        // Create other useful indexes if they don't exist
        try {
            await chatsCollection.createIndex({ isGroup: 1 });
            console.log('[FixChatIndex] ✅ Created isGroup index');
        } catch (error: any) {
            if (error.code !== 85) { // Index already exists
                console.log('[FixChatIndex] isGroup index already exists');
            }
        }
        
        try {
            await chatsCollection.createIndex({ team: 1, isActive: 1 });
            console.log('[FixChatIndex] ✅ Created team_isActive index');
        } catch (error: any) {
            if (error.code !== 85) { // Index already exists
                console.log('[FixChatIndex] team_isActive index already exists');
            }
        }
        
        console.log('[FixChatIndex] ✅ Database indexes fixed successfully');
        
    } catch (error) {
        console.error('[FixChatIndex] Error fixing indexes:', error);
    }
}

/**
 * migrate-users.mjs
 * 
 * Migrates users from a production JSON export into a target MongoDB database,
 * preserving their original bcrypt password hashes (no re-hashing needed since
 * the Mongoose User model has no pre-save hook for passwords).
 * 
 * After creating all users, it creates a "UCM Materials Team" and assigns
 * every user as a Member (the first user becomes the team Owner).
 * 
 * Usage:
 *   node migrate-users.mjs <database-name>
 * 
 * Examples:
 *   node migrate-users.mjs voltcloud@production
 *   node migrate-users.mjs voltcloud@development
 */

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MONGO_URI = 'mongodb://rodyherrera:F42DFB16FEC2A966B7F1ABA58852C@152.53.170.245:27017';
const MONGO_AUTH_SOURCE = 'admin';
const USERS_JSON_PATH = join(__dirname, 'voltcloud@production.users.json');
const TEAM_NAME = 'UCM Materials Team';
const TEAM_DESCRIPTION = 'Team for UCM Materials collaboration';

// ---------------------------------------------------------------------------
// System role definitions (mirrors src/core/constants/system-roles.ts)
// ---------------------------------------------------------------------------
const SYSTEM_ROLES = {
    Owner: {
        name: 'Owner',
        permissions: ['*'],
        isSystem: true
    },
    Admin: {
        name: 'Admin',
        permissions: [
            'trajectory:read', 'trajectory:create', 'trajectory:update', 'trajectory:delete',
            'analysis:read', 'analysis:create', 'analysis:update', 'analysis:delete',
            'plugin:read', 'plugin:create', 'plugin:update', 'plugin:delete',
            'scripting:read', 'scripting:create', 'scripting:update', 'scripting:delete',
            'container:read', 'container:create', 'container:update', 'container:delete',
            'daily-activity:read', 'daily-activity:create', 'daily-activity:update', 'daily-activity:delete',
            'ssh-connection:read', 'ssh-connection:create', 'ssh-connection:update', 'ssh-connection:delete',
            'team-invitation:read', 'team-invitation:create', 'team-invitation:update', 'team-invitation:delete',
            'team-member:read', 'team-member:create', 'team-member:update', 'team-member:delete',
            'team-role:read', 'team-role:create', 'team-role:update', 'team-role:delete',
            'simulation-cell:read', 'simulation-cell:create', 'simulation-cell:update', 'simulation-cell:delete',
            'ai-conversation:read', 'ai-conversation:create', 'ai-conversation:update', 'ai-conversation:delete',
            'whiteboard:read', 'whiteboard:create', 'whiteboard:update', 'whiteboard:delete'
        ],
        isSystem: true
    },
    Member: {
        name: 'Member',
        permissions: [
            'team:read',
            'trajectory:read', 'trajectory:create', 'trajectory:update', 'trajectory:delete',
            'analysis:read', 'analysis:create', 'analysis:update', 'analysis:delete',
            'plugin:read', 'plugin:create',
            'scripting:read', 'scripting:create', 'scripting:update', 'scripting:delete',
            'container:read', 'container:create', 'container:update', 'container:delete',
            'daily-activity:read',
            'ssh-connection:read', 'ssh-connection:create', 'ssh-connection:update', 'ssh-connection:delete',
            'simulation-cell:read',
            'ai-conversation:read', 'ai-conversation:create', 'ai-conversation:update', 'ai-conversation:delete',
            'whiteboard:read', 'whiteboard:create', 'whiteboard:update', 'whiteboard:delete'
        ],
        isSystem: true
    },
    Viewer: {
        name: 'Viewer',
        permissions: [
            'trajectory:read',
            'analysis:read',
            'plugin:read',
            'scripting:read',
            'container:read',
            'daily-activity:read',
            'simulation-cell:read',
            'whiteboard:read'
        ],
        isSystem: true
    }
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(){
    const dbName = process.argv[2];
    if(!dbName){
        console.error('Usage: node migrate-users.mjs <database-name>');
        console.error('  e.g. node migrate-users.mjs voltcloud@production');
        process.exit(1);
    }

    console.log(`\n=== User Migration Script ===`);
    console.log(`Target database: ${dbName}\n`);

    // Read source users
    const rawUsers = JSON.parse(readFileSync(USERS_JSON_PATH, 'utf-8'));
    console.log(`Found ${rawUsers.length} users in JSON export.\n`);

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI, { authSource: MONGO_AUTH_SOURCE });
    await client.connect();
    console.log('Connected to MongoDB.\n');

    const db = client.db(dbName);
    const usersCol = db.collection('users');
    const teamsCol = db.collection('teams');
    const teamRolesCol = db.collection('teamroles');
    const teamMembersCol = db.collection('teammembers');

    // ------------------------------------------------------------------
    // Step 1: Create users (preserving bcrypt password hashes)
    // ------------------------------------------------------------------
    console.log('--- Step 1: Creating users ---');
    const createdUserIds = [];

    for(const raw of rawUsers){
        const email = raw.email.toLowerCase().trim();

        // Check if user already exists
        const existing = await usersCol.findOne({ email });
        if(existing){
            console.log(`  [SKIP] ${email} already exists (id: ${existing._id})`);
            createdUserIds.push(existing._id);
            continue;
        }

        const now = new Date();
        const userDoc = {
            email,
            password: raw.password, // bcrypt hash preserved as-is
            role: raw.role || 'user',
            firstName: raw.firstName,
            lastName: raw.lastName || '',
            teams: [],
            analyses: [],
            oauthProvider: raw.oauthProvider || null,
            avatar: raw.avatar || null,
            createdAt: now,
            updatedAt: now,
            __v: 0
        };

        const result = await usersCol.insertOne(userDoc);
        createdUserIds.push(result.insertedId);
        console.log(`  [OK] ${email} -> ${result.insertedId}`);
    }

    console.log(`\nCreated/found ${createdUserIds.length} users.\n`);

    // ------------------------------------------------------------------
    // Step 2: Create team "UCM Materials Team"
    // ------------------------------------------------------------------
    console.log('--- Step 2: Creating team ---');

    // The first user (contact@rodyherrera.com) becomes the team owner
    const ownerId = createdUserIds[0];
    const now = new Date();

    // Check if team already exists
    let team = await teamsCol.findOne({ name: TEAM_NAME });
    if(team){
        console.log(`  [SKIP] Team "${TEAM_NAME}" already exists (id: ${team._id})\n`);
    } else {
        const teamDoc = {
            name: TEAM_NAME,
            description: TEAM_DESCRIPTION,
            owner: ownerId,
            createdAt: now,
            updatedAt: now,
            __v: 0
        };
        const teamResult = await teamsCol.insertOne(teamDoc);
        team = { _id: teamResult.insertedId, ...teamDoc };
        console.log(`  [OK] Team "${TEAM_NAME}" created -> ${team._id}\n`);
    }

    // ------------------------------------------------------------------
    // Step 3: Create system roles for the team
    // ------------------------------------------------------------------
    console.log('--- Step 3: Creating team roles ---');

    const roleIds = {};
    for(const [key, roleDef] of Object.entries(SYSTEM_ROLES)){
        const existing = await teamRolesCol.findOne({ team: team._id, name: roleDef.name });
        if(existing){
            roleIds[key] = existing._id;
            console.log(`  [SKIP] Role "${roleDef.name}" already exists (id: ${existing._id})`);
            continue;
        }

        const roleDoc = {
            team: team._id,
            name: roleDef.name,
            permissions: [...new Set(roleDef.permissions)],
            isSystem: roleDef.isSystem,
            createdAt: now,
            updatedAt: now,
            __v: 0
        };
        const roleResult = await teamRolesCol.insertOne(roleDoc);
        roleIds[key] = roleResult.insertedId;
        console.log(`  [OK] Role "${roleDef.name}" created -> ${roleResult.insertedId}`);
    }
    console.log('');

    // ------------------------------------------------------------------
    // Step 4: Add all users as team members
    // ------------------------------------------------------------------
    console.log('--- Step 4: Adding team members ---');

    for(let i = 0; i < createdUserIds.length; i++){
        const userId = createdUserIds[i];
        const isOwner = i === 0;
        const roleName = isOwner ? 'Owner' : 'Member';
        const roleId = roleIds[roleName];

        // Check if membership already exists
        const existingMember = await teamMembersCol.findOne({
            team: team._id,
            user: userId
        });
        if(existingMember){
            console.log(`  [SKIP] User ${userId} already a member`);
        } else {
            const memberDoc = {
                team: team._id,
                user: userId,
                role: roleId,
                joinedAt: now,
                createdAt: now,
                updatedAt: now,
                __v: 0
            };
            await teamMembersCol.insertOne(memberDoc);
            console.log(`  [OK] User ${userId} added as ${roleName}`);
        }

        // Add team to user's teams array (if not already there)
        await usersCol.updateOne(
            { _id: userId, teams: { $ne: team._id } },
            { $push: { teams: team._id } }
        );
    }

    console.log(`\n=== Migration complete ===`);
    console.log(`  Users: ${createdUserIds.length}`);
    console.log(`  Team: "${TEAM_NAME}" (${team._id})`);
    console.log(`  Owner: ${rawUsers[0].email}`);
    console.log(`  Members: ${createdUserIds.length - 1}`);
    console.log('');

    await client.close();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});

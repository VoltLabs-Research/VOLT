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

import { Request, Response } from 'express';
import { join, resolve, relative, dirname } from 'path';
import { promises as fs } from 'fs';
import mime from 'mime-types';
import TrajectoryFS from '@/services/trajectory-fs';
import RuntimeError from '@/utilities/runtime-error';

type EntryType = 'file' | 'dir';

interface FsEntry{
    type: EntryType;
    name: string;
    relPath: string;
    size?: number;
    mtime?: string;
    ext?: string | null;
    mime?: string | false;
}

const getDirSize= async (
    dirAbs: string,
    opts: { includeHidden: boolean; mode: 'shallow' | 'recursive'; maxDepth?: number },
    depth = 0
): Promise<number> => {
    const { includeHidden, mode } = opts;
    const maxDepth = typeof opts.maxDepth === 'number' ? opts.maxDepth : Infinity;

    let total = 0;
    const entries = await fs.readdir(dirAbs, { withFileTypes: true });
    for(const entry of entries){
        if(!includeHidden && entry.name.startsWith('.')) continue;
        
        const p = join(dirAbs, entry.name);
        const st = await fs.lstat(p);
        if(st.isSymbolicLink()) continue;

        if(st.isFile()){
            total += st.size;
        }else if(st.isDirectory() && mode === 'recursive' && depth < maxDepth){
            total += await getDirSize(p, opts, depth + 1);
        }
    }

    return total;
};

const safeResolve = (root: string, userRelPath?: string) => {
    const rel = (userRelPath || '').replace(/^\/*/, '');
    const abs = resolve(root, rel);
    const inside = abs.startsWith(root + '/') || abs === root;
    if(!inside){
        throw new RuntimeError('Trajectory::InvalidPath', 400);
    }
    return { abs, rel };
};

const breadcrumbsOf = (rel: string) => {
    const parts = rel.split('/').filter(Boolean);
    const crumbs = [{ name: 'root', relPath: '' }];
    let acc = '';
    for(const part of parts){
        acc = acc ? `${acc}/${part}` : part;
        crumbs.push({ name: part, relPath: acc });
    }
    return crumbs;
};

export const listTrajectoryFs = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const pathParam = String(req.query.path) || '';
    const includeHidden = String(req.query.hidden || 'false') === 'true';

    const trajFS = new TrajectoryFS(trajectory.folderId);
    const root = trajFS.root;

    const { abs, rel } = safeResolve(root, pathParam);
    
    const st = await fs.lstat(abs);
    // avoid symlinks 
    if(st.isSymbolicLink()){
        throw new RuntimeError('Trajectory::SymbolicLinksNotAllowed', 400);
    }

    let targetDir = abs;
    let selected: string | null = null;

    if(st.isFile()){
        selected = rel;
        targetDir = dirname(abs);
    }

    const dirItems = await fs.readdir(targetDir, { withFileTypes: true });
    const entries: FsEntry[] = [];

    for(const entry of dirItems){
        if(!includeHidden && entry.name.startsWith('.')) continue;

        const entryAbs = join(targetDir, entry.name);
        const entryRel = relative(root, entryAbs);
        const entryStat = await fs.lstat(entryAbs);
        if(entryStat.isSymbolicLink()) continue;

        if(entryStat.isDirectory()){
            const size = await getDirSize(entryAbs, {
                includeHidden,
                mode: 'recursive'
            });

            entries.push({
                type: 'dir',
                name: entry.name,
                relPath: entryRel,
                mtime: entryStat.mtime.toISOString(),
                size
            });
        }else if(entryStat.isFile()){
            const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : null;
            const m = mime.lookup(ext || '') || false;
            entries.push({
                type: 'file',
                name: entry.name,
                relPath: entryRel,
                size: entryStat.size,
                mtime: entryStat.mtime.toISOString(),
                ext,
                mime: m
            });
        }
    }

    const cwdRel = relative(root, targetDir);
    const breadcrumbs = breadcrumbsOf(cwdRel);

    res.status(200).json({
        status: 'success',
        data: {
            trajectory,
            cwd: cwdRel,
            selected,
            breadcrumbs,
            entries
        }
    });
};

export const downloadTrajectoryFs = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;

    const pathParam = String(req.query.path || '');
    const trajFS = new TrajectoryFS(trajectory.folderId);
    const root = trajFS.root;

    const { abs, rel } = safeResolve(root, pathParam);
    const st = await fs.lstat(abs);

    if(st.isSymbolicLink()){
        throw new RuntimeError('Trajectory::SymbolicLinksNotAllowed', 400);
    }

    if(!st.isFile()){
        return res.status(400).json({ status: 'error', data: { error: 'Not a file' } });
    }

    const ct = mime.lookup(abs) || 'application/octet-stream';
    res.setHeader('Content-Type', String(ct));
    res.setHeader('Content-Length', st.size)    ;
    res.setHeader('Content-Disposition', `attachment; filename="${rel.split('/').pop()}"`);
    return res.sendFile(abs);
};
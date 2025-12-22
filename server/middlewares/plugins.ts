import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Plugin from '@/models/plugin';
import RuntimeError from '@/utilities/runtime/runtime-error';

/**
 * Load plugin into res.locals by ID or slug
 */
export const loadPlugin = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const query: any = { $or: [{ slug: id }] };
    if (mongoose.Types.ObjectId.isValid(id)) {
        query.$or.push({ _id: id });
    }

    const plugin = await Plugin.findOne(query);
    if (!plugin) {
        return next(new RuntimeError('Plugin::NotFound', 404));
    }
    res.locals.plugin = plugin;
    next();
};

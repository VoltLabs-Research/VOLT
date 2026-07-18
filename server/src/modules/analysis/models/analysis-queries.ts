/**
 * Plain query functions for the Analysis model, replacing the deleted
 * AnalysisRepository for the two custom queries it used to expose
 * (`findRuntimeTargetsByTrajectoryId`, `findByTeamAndSearch`) that are
 * consumed from more than one module. ActiveRecord style: talks directly to
 * AnalysisModel, no repository/mapper indirection.
 */
import mongoose from 'mongoose';
import type { FilterQuery } from 'mongoose';
import type { Analysis } from '@shared/contracts/types/AnalysisProps';
import type { PaginatedResult, PopulatePath } from '@shared/domain/port/IBaseRepository';
import AnalysisModel, { toAnalysisLike, type AnalysisDocument } from '@modules/analysis/models/AnalysisModel';

export interface AnalysisRuntimeTarget {
    analysisId: string;
    computeClusterId: string | undefined;
}

export const findRuntimeTargetsByTrajectoryId = async (trajectoryId: string): Promise<AnalysisRuntimeTarget[]> => {
    const docs = await AnalysisModel.find({ trajectory: trajectoryId })
        .select('_id computeClusterId')
        .lean()
        .exec() as Array<{ _id: mongoose.Types.ObjectId | string; computeClusterId?: mongoose.Types.ObjectId | string | null }>;

    return docs.map((doc) => ({
        analysisId: String(doc._id),
        computeClusterId: doc.computeClusterId ? String(doc.computeClusterId) : undefined
    }));
};

export interface FindByTeamAndSearchOptions {
    teamId: string;
    search: string;
    trajectoryIds?: string[];
    page?: number;
    limit?: number;
    populate?: string | string[] | PopulatePath | PopulatePath[];
}

export const findByTeamAndSearch = async ({
    teamId,
    search,
    trajectoryIds = [],
    page = 1,
    limit = 20,
    populate
}: FindByTeamAndSearchOptions): Promise<PaginatedResult<Analysis>> => {
    const normalizedSearch = search.trim();
    const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSearch, 'i');
    const filter: FilterQuery<AnalysisDocument> = {
        team: teamId,
        $or: [
            { pluginDisplayName: regex },
            ...(trajectoryIds.length > 0 ? [{ trajectory: { $in: trajectoryIds } }] : []),
            ...(mongoose.Types.ObjectId.isValid(normalizedSearch) ? [{ _id: normalizedSearch }] : [])
        ]
    };
    const skip = (page - 1) * limit;

    let query = AnalysisModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }) as any;
    if (populate) {
        query = query.populate(populate as any);
    }

    const [docs, total] = await Promise.all([
        query.exec(),
        AnalysisModel.countDocuments(filter)
    ]);

    return {
        data: docs.map((doc: AnalysisDocument) => toAnalysisLike(doc)),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit
    };
};

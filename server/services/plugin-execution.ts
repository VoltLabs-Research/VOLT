/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 * Plugin Execution Service - Handles plugin evaluation and job creation
 */

import mongoose from 'mongoose';
import { Analysis, User, DailyActivity } from '@/models';
import { TeamActivityType } from '@/models/daily-activity';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import { IPlugin } from '@/types/models/modifier';
import { PluginStatus } from '@/types/models/plugin';
import { getAnalysisQueue } from '@/queues';
import Plugin from '@/models/plugin';
import PluginWorkflowEngine from '@/services/plugin-workflow-engine';

export interface ExecutePluginOptions {
    config: Record<string, any>;
    selectedFrameOnly?: boolean;
    timestep?: number;
}

export interface ExecutePluginResult {
    analysisId: string;
    totalJobs: number;
}

class PluginExecutionService {
    /**
     * Execute a plugin on a trajectory
     */
    async executePlugin(
        pluginSlug: string,
        trajectoryId: string,
        trajectory: any,
        userId: string,
        options: ExecutePluginOptions
    ): Promise<ExecutePluginResult> {
        const plugin = await Plugin.findOne({
            slug: pluginSlug,
            status: PluginStatus.PUBLISHED
        });

        if (!plugin) {
            throw new Error('Plugin::NotFound');
        }

        if (!plugin.validated) {
            throw new Error('Plugin::NotValid::CannotExecute');
        }

        const analysisId = new mongoose.Types.ObjectId();

        const engine = new PluginWorkflowEngine();
        const forEachResult = await engine.evaluateForEachItems(
            plugin,
            trajectoryId,
            analysisId.toString(),
            options.config || {},
            trajectory.team,
            { selectedFrameOnly: options.selectedFrameOnly, timestep: options.timestep }
        );

        if (!forEachResult || !forEachResult.items.length) {
            throw new Error('Plugin::ForEach::NoItems');
        }

        const { items } = forEachResult;

        await Analysis.create({
            _id: analysisId,
            plugin: plugin.slug,
            config: options.config,
            trajectory: trajectoryId,
            createdBy: userId,
            startedAt: new Date(),
            totalFrames: items.length
        });

        await User.findByIdAndUpdate(userId, {
            $push: { analyses: analysisId }
        });

        const teamId = (trajectory.team && typeof trajectory.team !== 'string')
            ? trajectory.team.toString()
            : String(trajectory.team);

        await this.recordActivity(teamId, userId, plugin, trajectory);

        const jobs = this.createJobs(analysisId, teamId, trajectoryId, plugin, trajectory, items, options.config);

        const analysisQueue = getAnalysisQueue();
        analysisQueue.addJobs(jobs);

        return {
            analysisId: analysisId.toString(),
            totalJobs: jobs.length
        };
    }

    private async recordActivity(
        teamId: string,
        userId: string,
        plugin: IPlugin,
        trajectory: any
    ): Promise<void> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const user = await User.findById(userId).select('firstName lastName').lean();
        const userName = user ? `${user.firstName} ${user.lastName}` : 'Someone';
        const pluginName = plugin.modifier?.name || plugin.slug;
        const trajectoryName = trajectory.name || 'Untitled Trajectory';

        await DailyActivity.updateOne(
            { team: teamId, user: userId, date: startOfDay },
            {
                $push: {
                    activity: {
                        type: TeamActivityType.ANALYSIS_PERFORMED,
                        user: userId,
                        description: `${userName} has executed the "${pluginName}" plugin for the trajectory (${trajectoryName})`,
                        createdAt: new Date()
                    }
                }
            },
            { upsert: true }
        );
    }

    private createJobs(
        analysisId: mongoose.Types.ObjectId,
        teamId: string,
        trajectoryId: string,
        plugin: IPlugin,
        trajectory: any,
        items: any[],
        config: Record<string, any>
    ): AnalysisJob[] {
        return items.map((item: any, index: number) => ({
            jobId: `${analysisId.toString()}-${index}`,
            teamId,
            trajectoryId,
            config,
            inputFile: item.path || '',
            analysisId: analysisId.toString(),
            timestep: item.timestep ?? item.frame,
            trajectoryName: trajectory.name,
            modifierId: plugin.slug,
            plugin: plugin.slug,
            name: plugin.modifier?.name || plugin.slug,
            // @ts-ignore
            message: trajectory.name,
            totalItems: items.length,
            itemIndex: index,
            forEachItem: item,
            forEachIndex: index
        }));
    }
}

export default new PluginExecutionService();

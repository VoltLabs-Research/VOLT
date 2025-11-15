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

import os from 'os';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import useClusterId from '@/utilities/use-cluster-id';
import http from 'http';
import https from 'https';
import { exec } from 'child_process';
import { redis } from '@/config/redis';
import { promisify } from 'util';

const execPromise = promisify(exec);

type ServerStatus = 'Healthy' | 'Warning' | 'Critical';

interface NetworkCheck{
    bytes: { received: number; sent: number };
    timestamp: number; 
};

interface CPUTimes{
    idle: number;
    total: number;
};

interface DiskIOCheck{
    reads: number;
    writes: number;
    timestamp: number;
    readSectors: number;
    writeSectors: number;
};

export default class MetricsCollector{
    private lastNetworkCheck: NetworkCheck | null = null;
    private lastCPUTimes: CPUTimes[] | null = null;
    private lastDiskIO: DiskIOCheck | null = null;
    private redisMetricsKey: string;
    private metricsTTL: number;

    constructor(
        metricsKey: string = 'metrics-history',
        ttl: number = 24 * 60 * 60
    ){
        this.redisMetricsKey = useClusterId(metricsKey);
        this.metricsTTL = ttl;
    }

    /**
     * Get CPU usage percentage
     */
    private getCPUUsage(): number{
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach((cpu) => {
            for(const type in cpu.times){
                totalTick += (cpu.times as any)[type];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~(100 * idle / total);

        return Math.min(100, Math.max(0, usage));
    }

    /**
     * Get individual CPU core usage percentages
     */
    private getCPUCoresUsage(): number[]{
        const cpus = os.cpus();

        // Calculate current time for each core 
        // TODO: Duplicated code
        const currentTimes = cpus.map((cpu) => {
            let total = 0;
            for(const type in cpu.times){
                total += (cpu.times as any)[type];
            }
            return {
                idle: cpu.times.idle,
                total
            };
        });

        // If no previous data, initialize and return zeros
        if(!this.lastCPUTimes){
            this.lastCPUTimes = currentTimes;
            return cpus.map(() => 0);
        }

        // Calculate usage based on delta
        const coreUsages = currentTimes.map((current, index) => {
            const last = this.lastCPUTimes![index];

            const idleDelta = current.idle - last.idle;
            const totalDelta = current.total - last.total;

            if(totalDelta === 0) return 0;
            
            const usage = 100 - (100 * idleDelta / totalDelta);
            return Math.min(100, Math.max(0, Math.round(usage)));
        });

        // Update last times
        this.lastCPUTimes = currentTimes;

        return coreUsages;
    }

    /**
     * Get memory metrics
     */
    private getMemoryMetrics(){
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usagePercent = (used / total) * 100;

        return {
            // GB
            total: total / (1024 ** 3),
            used: used / (1024 ** 3),
            free: free / (1024 ** 3),
            usagePercent: Math.round(usagePercent)
        };
    }

    /**
     * Get disk metrics
     */
    private async getDiskMetrics(){
        try{
            const { stdout } = await execPromise('df -B1 / | tail -1');
            const parts = stdout.trim().split(/\s+/);
            
            const total = parseInt(parts[1]) || 0;
            const used = parseInt(parts[2]) || 0;
            const available = parseInt(parts[3]) || 0;
            const usagePercent = parseInt(parts[4]?.replace('%', '')) || 0;
            
            return {
                total: Math.round((total / (1024 ** 3)) * 100) / 100,
                used: Math.round((used / (1024 ** 3)) * 100) / 100,
                free: Math.round((available / (1024 ** 3)) * 100) / 100,
                usagePercent
            };
        }catch(error: any){
            console.error('Error getting disk metrics:', error);
            return { total: 0, used: 0, free: 0, usagePercent: 0 };
        }
    }

    /**
     * Ping a host and return latency in ms
     */
    private async pingHost(host: string): Promise<number>{
        return new Promise((resolve) => {
            const start = Date.now();
            const protocol = host.startsWith('https') ? https : http;
            const url = new URL(host.includes('://') ? host : `http://${host}`);

            const req = protocol.get({
                hostname: url.hostname,
                port: url.port || (protocol === https ? 443 : 80),
                path: '/',
                timeout: 2000
            }, () => {
                resolve(Date.now() - start);
                req.destroy();
            });

            // TODO: maybe notify to the client about the error
            req.on('error', () => resolve(999));
            req.on('timeout', () => {
                req.destroy();
                resolve(999);
            });
        });
    }

    /**
     * Get response time from multiple sources
     */
    private async getResponseTimes(){
        const mongooseLatency = await this.pingMongoose();
        const redisLatency = await this.pingRedis();
        const selfLatency = await this.pingHost(`0.0.0.0:${process.env.SERVER_PORT}`);

        return {
            mongodb: mongooseLatency,
            redis: redisLatency,
            self: selfLatency,
            average: Math.round((mongooseLatency + redisLatency + selfLatency) / 3)
        }
    }

    private async pingMongoose(): Promise<number>{
        try{
            const start = Date.now();
            await mongoose.connection.db?.admin().ping();
            return Date.now() - start;
        }catch{
            return 0;
        }
    }

    private async pingRedis(): Promise<number>{
        try{
            if(!redis) return 0;
            // TODO: Duplicated code
            const start = Date.now();
            await redis.ping();
            return Date.now() - start;
        }catch{
            return 0;
        }
    }

    /**
     * Get network metrics from /proc/net/dev
     */
    private async getNetworkMetrics(){
        try{
            const data = await fs.readFile('/proc/net/dev', 'utf8');
            const lines = data.split('\n');

            let totalRx = 0;
            let totalTx = 0;

            // Parse network interfaces (skip header lines)
            for(let i = 2; i < lines.length; i++){
                const line = lines[i].trim();
                if(!line) continue;

                const parts = line.split(/\s+/);
                const iface = parts[0].replace(':', '');

                // Skip loopback interface
                if(iface === 'lo') continue;

                // Bytes received is column 1, bytes transmitted is column 9
                const rxBytes = parseInt(parts[1]) || 0;
                const txBytes = parseInt(parts[9]) || 0;

                totalRx += rxBytes;
                totalTx += txBytes;
            }

            const currentTime = Date.now();
            if(!this.lastNetworkCheck){
                // First call, initialize
                this.lastNetworkCheck = {
                    bytes: {
                        received: totalRx,
                        sent: totalTx
                    },
                    timestamp: currentTime
                };

                return {
                    incoming: 0,
                    outgoing: 0,
                    total: 0
                };
            }

            // Calculate bytes transferred since last check
            // timeDiff in seconds!
            const timeDiff = (currentTime - this.lastNetworkCheck.timestamp) / 1000;
            const bytesReceived = Math.max(0, totalRx - this.lastNetworkCheck.bytes.received);
            const bytesSent = Math.max(0, totalTx - this.lastNetworkCheck.bytes.sent);

            // Convert to KB/s
            const incoming = timeDiff > 0 ? (bytesReceived / 1024) / timeDiff : 0;
            const outgoing = timeDiff > 0 ? (bytesSent / 1024) / timeDiff : 0;

            // Update last check
            this.lastNetworkCheck = {
                bytes: {
                    received: totalRx,
                    sent: totalTx
                },
                timestamp: currentTime
            };

            return {
                // Round to 1 decimal
                incoming: Math.round(incoming * 10) / 10,
                outgoing: Math.round(outgoing * 10) / 10,
                total: Math.round((incoming + outgoing) * 10) / 10
            };
        }catch(error: any){
            console.error('Error reading network stats:', error);
            // Fallback to minimal values
            return {
                incoming: 0,
                outgoing: 0,
                total: 0
            };
        }
    }

    /**
     * Get MongoDB metrics
     */
    private async getMongoDBMetrics(){
        try{
            const db = mongoose.connection.db;
            if(!db) return null;

            const adminDb = db.admin();
            const serverStatus = await adminDb.serverStatus();

            const opcounters = serverStatus.opcounters || {};
            const queries = (opcounters.query || 0) + (opcounters.getmore || 0);

            // opLatencies.reads.latency is in microseconds, ops is operation count
            const readLatency = serverStatus.opLatencies?.reads || { latency: 0, ops: 1 };
            const latencyMs = readLatency.ops > 0
                // Microseconds to ms
                ? Math.round(readLatency.latency / readLatency.ops / 1000)
                : 0;
            
            return {
                connections: serverStatus.connections?.current || 0,
                queries,
                latency: Math.max(0, latencyMs)
            };
        }catch(error: any){
            console.error('Error collecting MongoDB metrics:', error);
            return null;
        }
    }
    
    /**
     * Get disk operations metrics
     */
    private async getDiskOperations(){
        try{
            const data = await fs.readFile('/proc/diskstats', 'utf8');
            const lines = data.split('\n');
            const currentTime = Date.now();

            let totalReadOps = 0;
            let totalWriteOps = 0;
            let totalReadSectors = 0;
            let totalWriteSectors = 0;

            for(const line of lines){
                const parts = line.trim().split(/\s+/);
                if(parts.length < 14) continue;

                const deviceName = parts[2];
                
                // Only physical disks (not partitions)
                if(!/^(sd[a-z]|nvme\d+n\d+|vd[a-z]|hd[a-z])$/.test(deviceName)) continue;
                
                // Skip ALL partitions (nvme0n1p1, sda1, vda2, etc.)
                if(/\d+$/.test(deviceName) && !/^nvme\d+n\d+$/.test(deviceName)) continue;

                // /proc/diskstats columns:
                // [3] reads completed
                // [5] sectors read
                // [7] writes completed  
                // [9] sectors written
                totalReadOps += parseInt(parts[3]) || 0;
                totalReadSectors += parseInt(parts[5]) || 0;
                totalWriteOps += parseInt(parts[7]) || 0;
                totalWriteSectors += parseInt(parts[9]) || 0;
            }

            // First call: initialize baseline
            if(!this.lastDiskIO){
                this.lastDiskIO = {
                    reads: totalReadOps,
                    writes: totalWriteOps,
                    readSectors: totalReadSectors,
                    writeSectors: totalWriteSectors,
                    timestamp: currentTime
                };
                return { 
                    read: 0,
                    write: 0,
                    speed: 0
                };
            }

            const timeDiff = (currentTime - this.lastDiskIO.timestamp) / 1000;
            
            // Prevent division by zero
            if(timeDiff <= 0){
                return { read: 0, write: 0, speed: 0 };
            }
            
            // Calculate IOPS (operations per second)
            const readOpsDelta = Math.max(0, totalReadOps - this.lastDiskIO.reads);
            const writeOpsDelta = Math.max(0, totalWriteOps - this.lastDiskIO.writes);
            const readIOPS = Math.round(readOpsDelta / timeDiff);
            const writeIOPS = Math.round(writeOpsDelta / timeDiff);
            
            // Calculate throughput in MB/s
            // Standard sector size is 512 bytes
            const SECTOR_SIZE = 512;
            const readSectorsDelta = Math.max(0, totalReadSectors - this.lastDiskIO.readSectors);
            const writeSectorsDelta = Math.max(0, totalWriteSectors - this.lastDiskIO.writeSectors);
            
            const readMBps = ((readSectorsDelta * SECTOR_SIZE) / (1024 * 1024)) / timeDiff;
            const writeMBps = ((writeSectorsDelta * SECTOR_SIZE) / (1024 * 1024)) / timeDiff;

            // Update baseline for next calculation
            this.lastDiskIO = {
                reads: totalReadOps,
                writes: totalWriteOps,
                readSectors: totalReadSectors,
                writeSectors: totalWriteSectors,
                timestamp: currentTime
            };

            return {
                // MB/s (2 decimals)
                read: Math.round(readMBps * 100) / 100,
                write: Math.round(writeMBps * 100) / 100,
                // Total IOPS
                speed: readIOPS + writeIOPS,
                // Include individual IOPS
                readIOPS,
                writeIOPS
            };
        } catch (error: any) {
            console.error('Error reading disk operations:', error);
            return { 
                read: 0, 
                write: 0, 
                speed: 0,
                readIOPS: 0,
                writeIOPS: 0
            };
        }
    }

    /**
     * Determine server status based on metrics
     */
    private determineStatus(cpu: number, memory: number, disk: number): ServerStatus{
        if(cpu >= 90 || memory >= 90 || disk >= 90) return 'Critical';
        if(cpu >= 75 || memory >= 75 || disk >= 85) return 'Warning';
        return 'Healthy';
    }

    /**
     * Collect all metrics
     */
    async collect(){
        try{
            const cpu = {
                usage: this.getCPUUsage(),
                cores: os.cpus().length,
                loadAvg: os.loadavg(),
                coresUsage: this.getCPUCoresUsage()
            };

            const memory = this.getMemoryMetrics();
            const disk = await this.getDiskMetrics();
            const network = await this.getNetworkMetrics();
            const mongodb = await this.getMongoDBMetrics();
            const responseTimes = await this.getResponseTimes();
            const diskOperations = await this.getDiskOperations();

            const status = this.determineStatus(cpu.usage, memory.usagePercent, disk.usagePercent);

            const metrics = {
                timestamp: new Date(),
                serverId: useClusterId(''),
                cpu,
                memory,
                disk,
                network,
                responseTime: responseTimes.average,
                responseTimes,
                diskOperations,
                status,
                uptime: os.uptime(),
                mongodb
            };

            // Save to Redis for real-time access
            await this.saveToRedis(metrics);
            return metrics;
        }catch(error: any){
            console.error('Error collecting metrics:', error);
            throw error;
        }
    }

    /**
     * Save metrics to Redis with timestamp as score in sorted set
     */
    private async saveToRedis(metrics: any){
        try{
            if(!redis){
                console.warn('Redis not available, skipping Redis storage');
                return;
            }

            const timestamp = new Date(metrics.timestamp).getTime();
            const metricsJson = JSON.stringify(metrics);

            // Add to sorted set with timestamp as score
            await redis.zadd(this.redisMetricsKey, timestamp, metricsJson);
        }catch(error: any){
            console.error('Error saving to Redis:', error);
        }
    }

    /**
     * Get metrics from Redis for the last N hours
     */
    async getMetricsFromRedis(hours: number = 24): Promise<any[]>{
        try{
            if(!redis){
                console.warn('Redis not available');
                return [];
            }

            const startTime = Date.now() - (hours * 60 * 60 * 1000);

            // Get all metrics since startTime
            const metricsData = await redis.zrangebyscore(
                this.redisMetricsKey,
                startTime,
                '+inf'
            );

            return metricsData.map((data: string) => JSON.parse(data));
        }catch(error: any){
            console.error('Error reading from Redis:', error);
            return [];
        }
    }

    /**
     * Get latest metrics from Redis
     */
    async getLatestFromRedis(): Promise<any | null>{
        try{
            if(!redis){
                console.warn('Redis not available');
                return null;
            }

            // Get the most recent metrics (highest score)
            const metrics = await redis.zrevrange(this.redisMetricsKey, 0, 0);

            if(metrics && metrics.length > 0){
                return JSON.parse(metrics[0]);
            }

            return null;
        }catch(error: any){
            console.error('Error reading latest from Redis:', error);
            return null;
        }
    }

    /**
     * Clean old metrics from Redis (older than TTL)
     */
    async cleanOldMetrics(): Promise<number>{
        try{
            if(!redis) return 0;
            // Calculate cutoff timestamp (current time - TTL)
            const cutoffTime = Date.now() - (this.metricsTTL * 1000);
            // Remove all metrics with score (timestamp) less than cutoffTime
            const removed = await redis.zremrangebyscore(this.redisMetricsKey, '-inf', cutoffTime);
            if(removed > 0){
                console.log(`Cleaned ${removed} old metrics from Redis`);
            }
            return removed;
        }catch(error: any){
            console.error('Error cleaning old metrics:', error);
            return 0;
        }
    }
}
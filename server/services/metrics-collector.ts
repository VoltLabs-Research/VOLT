import os from 'os';
import mongoose from 'mongoose';
import { ServerMetrics } from '@/models/server-metrics';
import { redis } from '@/config/redis';

const METRICS_REDIS_KEY = 'server:metrics:history';
const METRICS_TTL = 24 * 60 * 60; // 24 hours in seconds

export class MetricsCollector {
  private serverId: string;
  private previousNetworkStats: { rx: number; tx: number; timestamp: number } | null = null;
  private lastNetworkCheck: { bytes: { received: number; sent: number }; timestamp: number } | null = null;
  private lastCPUTimes: { idle: number; total: number }[] | null = null;

  constructor(serverId: string = 'backend-01') {
    this.serverId = serverId;
  }

  /**
   * Get CPU usage percentage
   */
  private getCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
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
  private getCPUCoresUsage(): number[] {
    const cpus = os.cpus();
    
    // Calculate current times for each core
    const currentTimes = cpus.map(cpu => {
      let total = 0;
      for (const type in cpu.times) {
        total += (cpu.times as any)[type];
      }
      return {
        idle: cpu.times.idle,
        total
      };
    });

    // If no previous data, initialize and return zeros
    if (!this.lastCPUTimes) {
      this.lastCPUTimes = currentTimes;
      return cpus.map(() => 0);
    }

    // Calculate usage based on delta
    const coreUsages = currentTimes.map((current, index) => {
      const last = this.lastCPUTimes![index];
      
      const idleDelta = current.idle - last.idle;
      const totalDelta = current.total - last.total;
      
      if (totalDelta === 0) return 0;
      
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
  private getMemoryMetrics() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = (used / total) * 100;

    return {
      total: total / (1024 ** 3), // GB
      used: used / (1024 ** 3),
      free: free / (1024 ** 3),
      usagePercent: Math.round(usagePercent)
    };
  }

  /**
   * Get disk metrics (simulated for now)
   */
  private async getDiskMetrics() {
    // In production, use libraries like 'diskusage' or 'node-disk-info'
    // For now, simulating based on system info
    return {
      total: 500, // GB
      used: 305,
      free: 195,
      usagePercent: 61
    };
  }

  /**
   * Ping a host and return latency in ms
   */
  private async pingHost(host: string): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      const http = require('http');
      const https = require('https');
      
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
  private async getResponseTimes() {
    const mongooseLatency = await this.pingMongoose();
    const redisLatency = await this.pingRedis();
    const selfLatency = await this.pingSelf();
    
    return {
      mongodb: mongooseLatency,
      redis: redisLatency,
      self: selfLatency,
      average: Math.round((mongooseLatency + redisLatency + selfLatency) / 3)
    };
  }

  private async pingMongoose(): Promise<number> {
    try {
      const start = Date.now();
      await mongoose.connection.db?.admin().ping();
      return Date.now() - start;
    } catch {
      return 0;
    }
  }

  private async pingRedis(): Promise<number> {
    try {
      if (!redis) return 0;
      const start = Date.now();
      await redis.ping();
      return Date.now() - start;
    } catch {
      return 0;
    }
  }

  private async pingSelf(): Promise<number> {
    try {
      const start = Date.now();
      const http = require('http');
      const port = process.env.SERVER_PORT;
      
      return new Promise((resolve) => {
        const req = http.get({
          hostname: '0.0.0.0',
          port,
          path: '/api/health',
          timeout: 2000
        }, () => {
          resolve(Date.now() - start);
          req.destroy();
        });
        
        req.on('error', () => resolve(999));
        req.on('timeout', () => {
          req.destroy();
          resolve(999);
        });
      });
    } catch {
      return 999;
    }
  }

  /**
   * Get network metrics - real system network traffic from /proc/net/dev
   */
  private async getNetworkMetrics() {
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile('/proc/net/dev', 'utf8');
      const lines = data.split('\n');
      
      let totalRx = 0;
      let totalTx = 0;
      
      // Parse network interfaces (skip header lines)
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(/\s+/);
        const iface = parts[0].replace(':', '');
        
        // Skip loopback interface
        if (iface === 'lo') continue;
        
        // bytes received is column 1, bytes transmitted is column 9
        const rxBytes = parseInt(parts[1]) || 0;
        const txBytes = parseInt(parts[9]) || 0;
        
        totalRx += rxBytes;
        totalTx += txBytes;
      }
      
      const currentTime = Date.now();
      
      if (!this.lastNetworkCheck) {
        // First call, initialize
        this.lastNetworkCheck = {
          bytes: { received: totalRx, sent: totalTx },
          timestamp: currentTime
        };
        return {
          incoming: 0,
          outgoing: 0,
          total: 0
        };
      }
      
      // Calculate bytes transferred since last check
      const timeDiff = (currentTime - this.lastNetworkCheck.timestamp) / 1000; // seconds
      const bytesReceived = Math.max(0, totalRx - this.lastNetworkCheck.bytes.received);
      const bytesSent = Math.max(0, totalTx - this.lastNetworkCheck.bytes.sent);
      
      // Convert to KB/s
      const incoming = timeDiff > 0 ? (bytesReceived / 1024) / timeDiff : 0;
      const outgoing = timeDiff > 0 ? (bytesSent / 1024) / timeDiff : 0;
      
      // Update last check
      this.lastNetworkCheck = {
        bytes: { received: totalRx, sent: totalTx },
        timestamp: currentTime
      };
      
      return {
        incoming: Math.round(incoming * 10) / 10, // Round to 1 decimal
        outgoing: Math.round(outgoing * 10) / 10,
        total: Math.round((incoming + outgoing) * 10) / 10
      };
    } catch (error) {
      console.error('[Metrics] Error reading network stats:', error);
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
  private async getMongoDBMetrics() {
    try {
      const db = mongoose.connection.db;
      if (!db) return null;

      const adminDb = db.admin();
      const serverStatus = await adminDb.serverStatus();
      
      // opLatencies.reads.latency is in microseconds, ops is operation count
      const readLatency = serverStatus.opLatencies?.reads || { latency: 0, ops: 1 };
      const latencyMs = readLatency.ops > 0 
        ? Math.round(readLatency.latency / readLatency.ops / 1000) // microseconds to ms
        : 0;
      
      return {
        connections: serverStatus.connections?.current || 0,
        queries: Math.min(100, Math.round(Math.random() * 50 + 10)), // Simulated realistic queries/s
        latency: Math.max(0, latencyMs) // Average latency in ms
      };
    } catch (error) {
      console.error('[Metrics] Error collecting MongoDB metrics:', error);
      return null;
    }
  }



  /**
   * Get drive information
   */
  private getDriveInfo() {
    // Simulated drive info for backend server
    return [
      { name: 'System', capacity: 0.5, used: 0.32, type: 'NVMe' },
      { name: 'Data', capacity: 2.0, used: 1.24, type: 'NVMe SSD' },
      { name: 'Logs', capacity: 1.5, used: 0.89, type: 'SATA SSD' },
      { name: 'Backup', capacity: 3.0, used: 1.82, type: 'HDD' }
    ];
  }

  /**
   * Get disk operations metrics
   */
  private getDiskOperations() {
    // Simulate realistic disk I/O operations
    const baseRead = 150 + Math.random() * 100 - 50;  // MB/s
    const baseWrite = 100 + Math.random() * 80 - 40;  // MB/s
    const baseSpeed = 1200 + Math.random() * 300 - 150; // IOPS

    return {
      read: Math.max(50, Math.round(baseRead)),
      write: Math.max(30, Math.round(baseWrite)),
      speed: Math.max(800, Math.round(baseSpeed))
    };
  }

  /**
   * Determine server status based on metrics
   */
  private determineStatus(cpu: number, memory: number, disk: number): 'Healthy' | 'Warning' | 'Critical' {
    if (cpu >= 90 || memory >= 90 || disk >= 90) return 'Critical';
    if (cpu >= 75 || memory >= 75 || disk >= 85) return 'Warning';
    return 'Healthy';
  }

  /**
   * Collect all metrics
   */
  async collect() {
    try {
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
      const drives = this.getDriveInfo();
      const responseTimes = await this.getResponseTimes();
      const diskOperations = this.getDiskOperations();

      const status = this.determineStatus(cpu.usage, memory.usagePercent, disk.usagePercent);

      const metrics = {
        timestamp: new Date(),
        serverId: this.serverId,
        cpu,
        memory,
        disk,
        network,
        responseTime: responseTimes.average,
        responseTimes,
        diskOperations,
        status,
        uptime: os.uptime(),
        mongodb,
        drives
      };

      // Save to database
      await ServerMetrics.create(metrics);

      // Save to Redis for real-time access
      await this.saveToRedis(metrics);

      return metrics;
    } catch (error) {
      console.error('[Metrics] Error collecting metrics:', error);
      throw error;
    }
  }

  /**
   * Get historical metrics
   */
  async getHistory(hours: number = 24) {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await ServerMetrics.find({
      serverId: this.serverId,
      timestamp: { $gte: startTime }
    })
      .sort({ timestamp: 1 })
      .lean();
  }

  /**
   * Get latest metrics
   */
  async getLatest() {
    return await ServerMetrics.findOne({ serverId: this.serverId })
      .sort({ timestamp: -1 })
      .lean();
  }

  /**
   * Save metrics to Redis with timestamp as score in sorted set
   */
  private async saveToRedis(metrics: any) {
    try {
      if (!redis) {
        console.warn('[Metrics] Redis not available, skipping Redis storage');
        return;
      }

      const timestamp = new Date(metrics.timestamp).getTime();
      const metricsJson = JSON.stringify(metrics);
      
      // Add to sorted set with timestamp as score
      await redis.zadd(METRICS_REDIS_KEY, timestamp, metricsJson);
      
      // Set expiration on the key to ensure cleanup
      await redis.expire(METRICS_REDIS_KEY, METRICS_TTL);
    } catch (error) {
      console.error('[Metrics] Error saving to Redis:', error);
    }
  }

  /**
   * Get metrics from Redis for the last N hours
   */
  async getMetricsFromRedis(hours: number = 24): Promise<any[]> {
    try {
      if (!redis) {
        console.warn('[Metrics] Redis not available');
        return [];
      }

      const startTime = Date.now() - (hours * 60 * 60 * 1000);
      
      // Get all metrics since startTime
      const metricsData = await redis.zrangebyscore(
        METRICS_REDIS_KEY,
        startTime,
        '+inf'
      );
      
      return metricsData.map((data: string) => JSON.parse(data));
    } catch (error) {
      console.error('[Metrics] Error reading from Redis:', error);
      return [];
    }
  }

  /**
   * Get latest metrics from Redis
   */
  async getLatestFromRedis(): Promise<any | null> {
    try {
      if (!redis) {
        console.warn('[Metrics] Redis not available');
        return null;
      }

      // Get the most recent metric (highest score)
      const metrics = await redis.zrevrange(METRICS_REDIS_KEY, 0, 0);
      
      if (metrics && metrics.length > 0) {
        return JSON.parse(metrics[0]);
      }
      
      return null;
    } catch (error) {
      console.error('[Metrics] Error reading latest from Redis:', error);
      return null;
    }
  }

  /**
   * Clean old metrics from Redis (older than 24 hours)
   */
  async cleanOldMetrics() {
    try {
      if (!redis) {
        console.warn('[Metrics] Redis not available');
        return;
      }

      const cutoffTime = Date.now() - METRICS_TTL * 1000;
      
      // Remove metrics older than 24 hours
      const removed = await redis.zremrangebyscore(
        METRICS_REDIS_KEY,
        '-inf',
        cutoffTime
      );
      
      if (removed > 0) {
        console.log(`[Metrics] Cleaned ${removed} old metrics from Redis`);
      }
    } catch (error) {
      console.error('[Metrics] Error cleaning old metrics:', error);
    }
  }
}

export default MetricsCollector;

export interface MemoryStats {
  used: number;
  total: number;
  external: number;
  heapUsed: number;
  heapTotal: number;
  heapUsedMB: number;
  heapTotalMB: number;
  usagePercent: number;
}

export const getMemoryStats = (): MemoryStats => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const usagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

  return {
    used: memUsage.rss,
    total: memUsage.heapTotal,
    external: memUsage.external,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    heapUsedMB,
    heapTotalMB,
    usagePercent,
  };
};

export const logMemoryUsage = (label: string = 'Memory Usage'): void => {
  const stats = getMemoryStats();
  console.log(`[${label}] Heap: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB (${stats.usagePercent}%)`);
};

export const checkMemoryThreshold = (thresholdMB: number = 1000): boolean => {
  const stats = getMemoryStats();
  return stats.heapUsedMB > thresholdMB;
};

export const forceGarbageCollection = (): void => {
  if (global.gc) {
    const before = getMemoryStats();
    global.gc();
    const after = getMemoryStats();
    console.log(`[GC] Memory freed: ${before.heapUsedMB - after.heapUsedMB}MB`);
  } else {
    console.warn('[GC] Garbage collection not available. Run with --expose-gc flag.');
  }
};

export const monitorMemoryUsage = (intervalMs: number = 30000): NodeJS.Timeout => {
  return setInterval(() => {
    const stats = getMemoryStats();
    if (stats.usagePercent > 80) {
      console.warn(`[Memory Warning] High memory usage: ${stats.usagePercent}% (${stats.heapUsedMB}MB)`);
      forceGarbageCollection();
    } else {
      logMemoryUsage('Memory Monitor');
    }
  }, intervalMs);
};

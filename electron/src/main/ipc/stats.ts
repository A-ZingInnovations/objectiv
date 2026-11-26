import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Sample CPU usage over a short interval.
 * Returns overall percent (0-100) and per-core percents.
 */
async function cpuUsagePercent(): Promise<{ overall: number; perCore: number[] }> {
  const start = os.cpus();
  const startTimes = start.map((c) => {
    const { user, sys, idle, irq } = c.times;
    return user + sys + idle + irq;
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
  const end = os.cpus();
  let totalDiff = 0;
  let idleDiff = 0;
  const perCore: number[] = [];
  for (let i = 0; i < end.length; i++) {
    const endTotal =
      end[i].times.user + end[i].times.sys + end[i].times.idle + end[i].times.irq;
    const startTotal = startTimes[i];
    const total = endTotal - startTotal;
    const idle = end[i].times.idle - start[i].times.idle;
    perCore.push(total > 0 ? Math.round(((1 - idle / total) * 100) * 10) / 10 : 0);
    totalDiff += total;
    idleDiff += idle;
  }
  const overall = totalDiff > 0 ? Math.round(((1 - idleDiff / totalDiff) * 100) * 10) / 10 : 0;
  return { overall, perCore };
}

/** Memory info. */
function memoryInfo(): {
  total: number;
  free: number;
  used: number;
  usedPercent: number;
} {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    free,
    used,
    usedPercent: Math.round((used / total) * 1000) / 10,
  };
}

/** Disk usage for a path (defaults to home / workspace root). */
async function diskUsage(path: string): Promise<{
  total: number;
  used: number;
  free: number;
  usedPercent: number;
} | null> {
  try {
    const { stdout } = await execFileAsync('df', ['-k', path], {
      maxBuffer: 1_000_000,
    });
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return null;
    const parts = lines[1].split(/\s+/).filter(Boolean);
    // df -k output: Filesystem 1K-blocks Used Available Use% Mounted-on
    const totalKb = Number(parts[1]) || 0;
    const usedKb = Number(parts[2]) || 0;
    const availKb = Number(parts[3]) || 0;
    const total = totalKb * 1024;
    const used = usedKb * 1024;
    const free = availKb * 1024;
    const usedPercent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
    return { total, used, free, usedPercent };
  } catch {
    return null;
  }
}

export async function handleStatsCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'stats_cpu': {
      const { overall, perCore } = await cpuUsagePercent();
      return { overall, perCore, cores: os.cpus().length };
    }
    case 'stats_memory': {
      return memoryInfo();
    }
    case 'stats_disk': {
      const target = String(args.path ?? os.homedir());
      return diskUsage(target);
    }
    case 'stats_all': {
      const [cpu, mem] = await Promise.all([cpuUsagePercent(), Promise.resolve(memoryInfo())]);
      const disk = await diskUsage(String(args.path ?? os.homedir()));
      return { cpu, memory: mem, disk };
    }
    default:
      return undefined;
  }
}

import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import {
  initialize,
  getGrantedPermissions,
  aggregateRecord,
  aggregateGroupByDuration,
} from 'react-native-health-connect';
import {
  getCoachConfig,
  getCoachSteps,
  updateCoachSteps,
  pruneOldSteps,
  saveCoachConfig,
  addCoachEvent,
  resolveCoachEvent,
  getFastHistory,
  getActiveFast
} from '../database/db';
import { loadStepsFromDb } from '../askesis/stepsStore';

const COACH_BACKGROUND_TASK = 'COACH_BACKGROUND_TASK';

// How far back a one-time backfill reaches. Retention keeps two years, so a
// full year gives every graph range (week/month/year) meaningful history.
const BACKFILL_DAYS = 365;

// Helper to get local date string YYYY-MM-DD
const toLocalIso = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export async function syncStepsFromHealthConnect(days: number = 30): Promise<{
  success: boolean;
  updatedCount: number;
  hasPermission: boolean;
  error?: string;
}> {
  try {
    const isInitialized = await initialize();
    if (!isInitialized) {
      return { success: false, updatedCount: 0, hasPermission: false, error: 'Health Connect failed to initialize' };
    }

    const granted = await getGrantedPermissions();
    const hasReadSteps = granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
    if (!hasReadSteps) {
      return { success: false, updatedCount: 0, hasPermission: false, error: 'Steps read permission not granted' };
    }

    let updated = 0;
    for (let i = 0; i < days; i++) {
      const dateStr = new Date();
      dateStr.setDate(dateStr.getDate() - i);
      dateStr.setHours(0, 0, 0, 0);

      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);

      const stepsData = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: dateStr.toISOString(),
          endTime: nextDay.toISOString(),
        },
      });

      let totalSteps = Number(stepsData?.COUNT_TOTAL);
      if (!Number.isFinite(totalSteps) || totalSteps < 0) {
        totalSteps = 0;
      }

      const localIsoStr = toLocalIso(dateStr);
      await updateCoachSteps(localIsoStr, totalSteps);
      updated++;
    }

    await pruneOldSteps();
    return { success: true, updatedCount: updated, hasPermission: true };
  } catch (err: any) {
    return {
      success: false,
      updatedCount: 0,
      hasPermission: false,
      error: err?.message || String(err),
    };
  }
}

// Fetch up to a year of daily step totals in a single Health Connect call.
// Health Connect buckets the range into one-day groups, which is far cheaper
// than querying day-by-day (365 native round-trips).
export async function backfillStepsFromHealthConnect(targetDays: number = BACKFILL_DAYS): Promise<{
  success: boolean;
  updatedCount: number;
  hasPermission: boolean;
  error?: string;
}> {
  try {
    const isInitialized = await initialize();
    if (!isInitialized) {
      return { success: false, updatedCount: 0, hasPermission: false, error: 'Health Connect failed to initialize' };
    }

    const granted = await getGrantedPermissions();
    const hasReadSteps = granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
    if (!hasReadSteps) {
      return { success: false, updatedCount: 0, hasPermission: false, error: 'Steps read permission not granted' };
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (targetDays - 1));

    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);

    const groups = await aggregateGroupByDuration({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      timeRangeSlicer: { duration: 'DAYS', length: 1 },
    });

    let updated = 0;
    for (const group of groups) {
      const bucketStart = new Date(group.startTime);
      if (Number.isNaN(bucketStart.getTime())) continue;

      let totalSteps = Number(group.result?.COUNT_TOTAL);
      if (!Number.isFinite(totalSteps) || totalSteps < 0) {
        totalSteps = 0;
      }

      await updateCoachSteps(toLocalIso(bucketStart), totalSteps);
      updated++;
    }

    await pruneOldSteps();
    return { success: true, updatedCount: updated, hasPermission: true };
  } catch (err: any) {
    return {
      success: false,
      updatedCount: 0,
      hasPermission: false,
      error: err?.message || String(err),
    };
  }
}

// Runs the year-long backfill once, then refreshes the in-memory cache. Safe to
// call on every boot; the `steps_backfilled` config flag gates the work.
export async function ensureStepsBackfill(): Promise<void> {
  try {
    const config = await getCoachConfig();
    if (config.steps_backfilled === 1) return;

    const result = await backfillStepsFromHealthConnect(BACKFILL_DAYS);
    if (!result.success) return;

    await saveCoachConfig({ steps_backfilled: 1 });
    await loadStepsFromDb();
  } catch (err) {
    console.warn('Steps backfill failed:', err);
  }
}

export async function executeCoachSync() {
  try {
    // 1. FASTING RULE (Independent)
    try {
      const config = await getCoachConfig();
      const fastDays = config.fasting_days ?? 3;
      const activeFast = await getActiveFast();
      const pastFasts = await getFastHistory(); 
      
      let daysSinceLastFast = 0;
      if (activeFast) {
        daysSinceLastFast = 0;
      } else if (Array.isArray(pastFasts) && pastFasts.length > 0) {
        // Defensive sorting: Explicitly guarantee order at the call site 
        // by sorting all fasts by end_time descending, rather than assuming query order.
        const sortedFasts = [...pastFasts].sort((a, b) => {
          const timeA = a.end_time ? new Date(a.end_time).getTime() : 0;
          const timeB = b.end_time ? new Date(b.end_time).getTime() : 0;
          return timeB - timeA;
        });

        const lastFastEnd = sortedFasts[0].end_time;
        if (lastFastEnd) {
          const lastEndTime = new Date(lastFastEnd).getTime();
          const nowTime = new Date().getTime();
          daysSinceLastFast = Math.floor((nowTime - lastEndTime) / (1000 * 60 * 60 * 24));
        }
      } else {
        daysSinceLastFast = fastDays + 1; // Never fasted
      }
      
      if (daysSinceLastFast >= fastDays) {
        await addCoachEvent('missed_fast');
      } else {
        await resolveCoachEvent('missed_fast');
      }
    } catch (err) {
      console.error('Fasting rule error:', err);
    }

    // 2. STEPS RULE
    try {
      // Fetch config first so the sync window always covers the days the rule
      // inspects (today plus the last `stepDays`).
      const config = await getCoachConfig();
      const stepThreshold = config.steps_threshold ?? 7000;
      const stepDays = config.steps_days ?? 3;

      const syncResult = await syncStepsFromHealthConnect(Math.max(stepDays + 1, 3));

      if (!syncResult.hasPermission && syncResult.error === 'Steps read permission not granted') {
        await resolveCoachEvent('insufficient_steps');
      } else if (syncResult.success) {

        const history = await getCoachSteps();

        const todayStrForRule = toLocalIso(new Date());
        const completedHistory = history.filter((s) => s.date < todayStrForRule);

        let anyDaySufficient = false;

        // First check if today has already met the requirement
        const todayRecord = history.find((s) => s.date === todayStrForRule);
        if (todayRecord && todayRecord.steps >= stepThreshold) {
          anyDaySufficient = true;
        }

        if (!anyDaySufficient) {
          // Check the past stepDays
          for (let i = 1; i <= stepDays; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = toLocalIso(d);

            const record = completedHistory.find((s) => s.date === dStr);
            const steps = record ? record.steps : 0;
            if (steps >= stepThreshold) {
              anyDaySufficient = true;
              break;
            }
          }
        }

        if (!anyDaySufficient) {
          await addCoachEvent('insufficient_steps');
        } else {
          await resolveCoachEvent('insufficient_steps');
        }
      }
    } catch (err) {
      console.error('Steps rule error:', err);
    }

    return true;
  } catch (error) {
    console.error('Coach background task critical failure:', error);
    return false;
  }
}

TaskManager.defineTask(COACH_BACKGROUND_TASK, async () => {
  const success = await executeCoachSync();
  return success ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
});

export async function registerCoachBackgroundTask() {
  try {
    const config = await getCoachConfig();
    // One-time migration: older installs registered at a 180 minute interval.
    // Re-register once to move them to the hourly cadence, then leave the
    // schedule alone so boots don't keep resetting the OS timer.
    const needsMigration = config.steps_bg_v2 !== 1;
    const isRegistered = await TaskManager.isTaskRegisteredAsync(COACH_BACKGROUND_TASK);

    if (isRegistered && needsMigration) {
      await BackgroundTask.unregisterTaskAsync(COACH_BACKGROUND_TASK);
    }
    if (!isRegistered || needsMigration) {
      await BackgroundTask.registerTaskAsync(COACH_BACKGROUND_TASK, {
        // Inexact: the OS treats this as a minimum and may run less often.
        minimumInterval: 60,
      });
    }
    if (needsMigration) {
      await saveCoachConfig({ steps_bg_v2: 1 });
    }
  } catch (err) {
    console.warn('Failed to register coach background task:', err);
  }
}

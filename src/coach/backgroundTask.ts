import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { initialize, getGrantedPermissions, aggregateRecord } from 'react-native-health-connect';
import {
  getCoachConfig,
  getCoachSteps,
  updateCoachSteps,
  addCoachEvent,
  resolveCoachEvent,
  getFastHistory,
  getActiveFast
} from '../database/db';

const COACH_BACKGROUND_TASK = 'COACH_BACKGROUND_TASK';

// Helper to get local date string YYYY-MM-DD
const toLocalIso = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

TaskManager.defineTask(COACH_BACKGROUND_TASK, async () => {
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
      const isInitialized = await initialize();
      
      if (!isInitialized) {
        // Transient initialization failure (e.g. HC temporarily unavailable).
        // Skip step evaluation this cycle. We do NOT clear the event here.
        console.warn('Health Connect failed to initialize. Skipping steps rule.');
      } else {
        const granted = await getGrantedPermissions();
        const hasReadSteps = granted.some(p => p.recordType === 'Steps' && p.accessType === 'read');

        if (!hasReadSteps) {
          // Initialization succeeded, but user genuinely has not granted/revoked permission.
          await resolveCoachEvent('insufficient_steps');
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const stepsData = await aggregateRecord({
            recordType: 'Steps',
            timeRangeFilter: {
              operator: 'between',
              startTime: today.toISOString(),
              endTime: tomorrow.toISOString(),
            }
          });
          
          let totalSteps = Number(stepsData?.COUNT_TOTAL);
          if (!Number.isFinite(totalSteps) || totalSteps < 0) {
            totalSteps = 0;
          }

          const todayStr = toLocalIso(today);
          await updateCoachSteps(todayStr, totalSteps);

          // Fetch config for steps separately to ensure rule independence
          const config = await getCoachConfig();
          const stepThreshold = config.steps_threshold ?? 7000;
          const stepDays = config.steps_days ?? 3;
          
          const history = await getCoachSteps();
          
          const todayStrForRule = toLocalIso(new Date());
          const completedHistory = history.filter(s => s.date < todayStrForRule);
          
          let anyDaySufficient = false;
          for (let i = 1; i <= stepDays; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = toLocalIso(d);
            
            const record = completedHistory.find(s => s.date === dStr);
            const steps = record ? record.steps : 0;
            if (steps >= stepThreshold) {
              anyDaySufficient = true;
              break;
            }
          }
          
          if (!anyDaySufficient) {
            await addCoachEvent('insufficient_steps');
          } else {
            await resolveCoachEvent('insufficient_steps');
          }
        }
      }
    } catch (err) {
      console.error('Steps rule error:', err);
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('Coach background task critical failure:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerCoachBackgroundTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(COACH_BACKGROUND_TASK);
  if (!isRegistered) {
    await BackgroundTask.registerTaskAsync(COACH_BACKGROUND_TASK, {
      minimumInterval: 60, // explicitly in minutes per expo-background-task definitions
    });
  }
}

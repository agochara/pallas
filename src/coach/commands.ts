import { myQuotes } from '../content/data';

export type CommandResult = {
  text: string;
  ui?: 'bmi' | 'search';
  payload?: any;
};

export async function executeCoachCommand(input: string): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { text: 'Unknown command. Type /help for available commands.' };
  }

  const spaceIndex = trimmed.indexOf(' ');
  const command = (spaceIndex === -1 ? trimmed : trimmed.substring(0, spaceIndex)).toLowerCase();
  const args = (spaceIndex === -1 ? '' : trimmed.substring(spaceIndex + 1)).trim();

  switch (command) {
    case '/help':
      return {
        text: [
          'Available Coach commands:',
          '• /1rm <weight>x<reps> — Calculate estimated 1RM (e.g. /1rm 70x5)',
          '• /bmi <weight> <height> — Calculate BMI (weight in kg, height in cm)',
          '• /convert <val> <kg|lbs> — Convert between kg and lbs (e.g. /convert 70kg, /convert 150lbs)',
          '• /search <pattern> — Search quote collection (substring or regex)',
          '• /hc — Request Health Connect step permissions',
          '• /steps — View today\'s steps directly from Health Connect',
          '• /synchc — Manually trigger background sync of steps and fasting rules',
          '• /help — Show this help menu',
        ].join('\n')
      };

    case '/1rm': {
      if (!args) return { text: 'Usage: /1rm <weight>x<reps> (e.g. /1rm 70x5 or /1rm 80 5)' };
      const match = args.match(/^([0-9.]+)\s*(?:[xX*]|\s+)\s*([0-9]+)$/);
      if (!match) return { text: 'Usage: /1rm <weight>x<reps> (e.g. /1rm 70x5)' };
      const weight = parseFloat(match[1]);
      const reps = parseInt(match[2], 10);
      if (isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
        return { text: 'Please enter valid positive numbers for weight and reps.' };
      }
      if (reps === 1) return { text: `Estimated 1RM for ${weight} kg x 1 rep is ${weight} kg.` };
      const oneRm = weight * (1 + reps / 30);
      return { text: `Estimated 1RM for ${weight} kg x ${reps} reps is ${oneRm.toFixed(1)} kg.` };
    }

    case '/bmi': {
      if (!args) return { text: 'Usage: /bmi <weight in kg> <height in cm> (e.g. /bmi 75 180)' };
      const parts = args.replace(/kg|cm|,/gi, ' ').trim().split(/\s+/);
      if (parts.length < 2) return { text: 'Usage: /bmi <weight in kg> <height in cm> (e.g. /bmi 75 180)' };
      const weight = parseFloat(parts[0]);
      const height = parseFloat(parts[1]);
      if (isNaN(weight) || isNaN(height) || weight <= 0 || height <= 0) {
        return { text: 'Please provide valid positive numbers for weight (kg) and height (cm).' };
      }
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);

      let category = 'Normal weight';
      if (bmi < 18.5) category = 'Underweight';
      else if (bmi < 25.0) category = 'Normal weight';
      else if (bmi < 30.0) category = 'Overweight';
      else category = 'Obese';

      return {
        text: `BMI: ${bmi.toFixed(1)} (${category}) [Weight: ${weight} kg, Height: ${height} cm]`,
        ui: 'bmi',
        payload: { bmi, weight, height, category }
      };
    }

    case '/convert': {
      if (!args) return { text: 'Usage: /convert <val> <kg|lbs> (e.g. /convert 70kg, /convert 150 lbs)' };
      const cleanArgs = args.replace(/\bto\b/gi, '').trim();
      const match = cleanArgs.match(/^([0-9.]+)\s*([a-zA-Z]+)?(?:\s+([a-zA-Z]+))?$/);
      if (!match) return { text: 'Usage: /convert <val> <kg|lbs> (e.g. /convert 70kg or /convert 150 lbs)' };
      const val = parseFloat(match[1]);
      const unit = (match[2] || match[3] || '').toLowerCase();
      if (isNaN(val) || val < 0) return { text: 'Please enter a valid positive number to convert.' };

      if (unit.startsWith('lb') || unit === 'pounds' || unit === 'pound') {
        const kg = val * 0.45359237;
        return { text: `${val} lbs = ${kg.toFixed(2)} kg` };
      } else if (unit.startsWith('kg') || unit === 'kilo' || unit === 'kilogram' || unit === 'kilograms') {
        const lbs = val / 0.45359237;
        return { text: `${val} kg = ${lbs.toFixed(2)} lbs` };
      } else {
        const toKg = val * 0.45359237;
        const toLbs = val / 0.45359237;
        return { text: `${val} kg = ${toLbs.toFixed(2)} lbs | ${val} lbs = ${toKg.toFixed(2)} kg` };
      }
    }

    case '/search': {
      if (!args) return { text: 'Usage: /search <regex or query> (e.g. /search soul)' };

      let regex: RegExp;
      try {
        const slashMatch = args.match(/^\/(.+)\/([gimsuy]*)$/);
        if (slashMatch) {
          const flags = slashMatch[2].includes('i') ? slashMatch[2] : slashMatch[2] + 'i';
          regex = new RegExp(slashMatch[1], flags);
        } else {
          regex = new RegExp(args, 'i');
        }
      } catch {
        const escaped = args.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, 'i');
      }

      const matches = myQuotes.filter((q) => regex.test(q));
      if (matches.length === 0) return { text: `No quotes found matching "${args}".` };

      // Return rich payload for interactive pagination!
      return {
        text: `Found ${matches.length} match${matches.length === 1 ? '' : 'es'} for "${args}".`,
        ui: 'search',
        payload: { matches, query: args }
      };
    }

    case '/hc': {
      try {
        const hc = await import('react-native-health-connect');
        const isInitialized = await hc.initialize();
        if (!isInitialized) {
          return { text: 'Health Connect could not be initialized.' };
        }
        await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
        return { text: 'Health Connect read permissions requested. (Note: Please also enable Background Read manually in Android Health Connect settings if you want passive coaching).' };
      } catch (err: any) {
        return { text: 'Health Connect error: ' + (err?.message || String(err)) };
      }
    }

    case '/steps': {
      try {
        const hc = await import('react-native-health-connect');
        const isInitialized = await hc.initialize();
        if (!isInitialized) {
          return { text: 'Health Connect could not be initialized.' };
        }
        const granted = await hc.getGrantedPermissions();
        if (!granted.some(p => p.recordType === 'Steps' && p.accessType === 'read')) {
          return { text: 'Steps read permission not granted. Run /hc to request permission.' };
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const stepsData = await hc.aggregateRecord({
          recordType: 'Steps',
          timeRangeFilter: {
            operator: 'between',
            startTime: today.toISOString(),
            endTime: tomorrow.toISOString(),
          }
        });
        const count = Number(stepsData?.COUNT_TOTAL) || 0;
        return { text: `You have taken ${count} steps today (live from Health Connect).` };
      } catch (err: any) {
        return { text: 'Health Connect error: ' + (err?.message || String(err)) };
      }
    }

    case '/synchc': {
      try {
        const { executeCoachSync } = await import('./backgroundTask');
        const success = await executeCoachSync();
        return { text: success ? 'Health Connect manual sync complete.' : 'Manual sync failed.' };
      } catch (err: any) {
        return { text: 'Sync error: ' + (err?.message || String(err)) };
      }
    }

    default:
      return { text: `Unknown command "${command}". Type /help for available commands.` };
  }
}

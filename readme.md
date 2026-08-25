# Pallas 🦉

Pallas is a personal, offline application.

The name refers to **Pallas Athena**, associated with wisdom, strategy, and war. The connections to the Owl, to Nike, and to Odysseus are noted. 

Pallas follows a **via negativa** design philosophy: keep the system small, direct, and useful. Avoid features that do not add value.

## Structure

Pallas contains three independent modules:

* 📜 **The Study** — reading, reflection, and daily intellectual material.
* 📓 **Vade Mecum** — a single continuous personal notepad and commonplace book.
* 🪽 **Askesis** — physical training, fasting, and weight tracking.

The launcher provides access to all modules. Each module can return to the Pallas launcher.

## The Study 📜

The Study is a daily editorial page that advances automatically with the calendar.

Its content is defined in `data.ts`.

It contains:

* **To Self** — a custom daily message.
* **From The Archives** — two randomly selected aphorisms from the quote collection.
* **Tao Te Ching** — one chapter per day, progressing sequentially through the 81 chapters.

The current issue and daily state are persisted locally so that the same day's content remains stable after reopening the application.

## Vade Mecum 📓

Vade Mecum is a single continuous personal notepad and commonplace book (*vade mecum* — "go with me").

* **One Continuous Document**: No separate notes, folders, tags, categories, tasks, checkboxes, or priorities.
* **Unconstrained Structure**: The user writes plain text for reading lists, thoughts, reminders, or ideas. The structure belongs to the user, not the application.
* **Restrained Typography**: Warm parchment background, dark charcoal text, serif typography, and generous line spacing.
* **Automatic Persistence**: Changes autosave directly to SQLite offline.

## Askesis 🪽

Askesis is the physical-training module. It contains four tabs in order: **Fasting, Strength, Weight, and Coach**.

### Fasting

Fasting maintains a complete history of fasting periods.

A fast can be:

* started and ended in real time;
* entered manually for a previous period;
* edited or deleted later.

The 7-day calendar displays fasting periods as a vertical bar chart with average fasting duration and weekly navigation.

### Strength

Six exercises are currently supported:

* Squat
* Bench Press
* Deadlift
* Clean & Press
* Pullups
* Chins

Only the current maximum is stored for each exercise. Bodyweight-only performance can be logged with 0 kg. No exercise history is maintained.

A new record replaces the existing maximum when appropriate, while the Strength interface also permits direct editing or clearing of a record.

### Weight

Weight tracks body weight measurements over time.

* Records individual weight measurements with calendar date (`YYYY-MM-DD`).
* Displays the current/latest weight prominently.
* Renders a continuous time-series chart with adaptive time ranges (W, M, 3M, Y) using a smooth EWMA trendline and translucent measurement scatter.
* Allows direct addition, editing, and deletion of measurements.
* Excludes goals, calorie tracking, streaks, or unnecessary analytics (*via negativa*).

### Coach

Coach is an ephemeral chat-like interface combining passive rule-based interventions with immediate utility commands.

* **Ephemeral Interface**: Conversations and command executions exist only in UI state and are never stored in SQLite.
* **Passive Interventions**: Driven by background rules evaluated periodically via Android WorkManager:
  * `insufficient_steps` ("Gotta walk!"): Triggered when aggregated steps from Android Health Connect fall below `steps_threshold` (default: 7,000) for `steps_days` (default: 3) consecutive calendar days.
  * `missed_fast` ("Gotta fast!"): Triggered when no fast has been logged for `fasting_days` (default: 3) consecutive calendar days.
  * Interventions are automatically resolved and removed from `coach_events` once the condition is met.
* **Badge Notification**: A Material 3 indicator appears on the Coach navigation icon whenever unresolved interventions exist in the database.
* **Slash Commands**:
  * `/1rm <weight>x<reps>` — Calculate estimated 1 Rep Max using the Epley formula.
  * `/bmi <weight> <height>` — Calculate Body Mass Index (weight in kg, height in cm) with category classification.
  * `/convert <val> <kg|lbs>` — Convert between kilograms and pounds (e.g. `/convert 70kg`, `/convert 150 lbs`).
  * `/search <pattern>` — Case-insensitive regex or substring search through bundled aphorisms (`myQuotes`).
  * `/hc` — Request Android Health Connect permissions.
  * `/synchc` — Manually trigger background sync of steps and fasting rules.
  * `/help` — Display command reference and usage examples.

## Data & Persistence

Pallas currently only has offline data. 

Local persistence is handled by **SQLite** using `expo-sqlite`. There is currently no required cloud backend or account system.

The database contains:

* `max_lifts` — current maximum lift for each exercise.
* `fasts` — fasting history.
* `weights` — body weight history with calendar dates.
* `vade_mecum` — continuous personal notepad content.
* `newsletter_settings` — The Study's persistent state and settings.
* `coach_config` — Coach threshold settings (`steps_threshold`, `steps_days`, `fasting_days`).
* `coach_steps` — rolling 15-day window of daily aggregated steps from Health Connect.
* `coach_events` — active unresolved Coach interventions.

The database uses SQLite WAL mode.

The application deliberately separates **user data** from **static content**:

* SQLite stores mutable personal data.
* `data.ts` stores bundled editorial content such as quotes and the Tao Te Ching.

## Data Management

Pallas Settings provides:

* JSON export of application data (including lifts, fasts, weights, Vade Mecum notes, and newsletter state).
* JSON import and merge.
* Granular deletion of lift, fasting, weight, or Vade Mecum data.
* Complete database reset.
* Direct SQLite query execution.

The SQL console allows raw `SELECT`, `INSERT`, `UPDATE`, and `DELETE` statements to be executed against the local database. This is intentional: Pallas is a personal application, so direct access to its data is preferable to building unnecessary administrative interfaces.

## Technical Stack

* **React Native**
* **Expo SDK 54**
* **TypeScript**
* **Expo SQLite**
* **React Native Health Connect**
* **Expo Task Manager Expo Task Manager & Background Fetch (Android WorkManager) Background Task (Android WorkManager)**
* **Expo FileSystem / Sharing APIs**
* **React Native Safe Area Context**
* **EAS Build**

### Project structure

```text
pallas/
├── assets/
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash-icon.png
│
├── src/
│   ├── askesis/
│   │   └── screens.tsx         # Askesis UI, lifts, fasting, weight, coach
│   │
│   ├── coach/
│   │   ├── backgroundTask.ts   # Health Connect sync & WorkManager rule evaluation
│   │   └── commands.ts         # Slash command parser and handlers (/1rm, /bmi, etc.)
│   │
│   ├── content/
│   │   ├── data.ts             # Static content / seed data / myQuotes
│   │
│   ├── database/
│   │   ├── db.ts               # SQLite database, tables, and queries
│   │   └── export.ts           # Data import/export
│   │
│   ├── settings/
│   │   └── settings-screen.tsx # SQL console, data export/import, settings
│   │
│   ├── the-study/
│   │   └── study.tsx           # The Study
│   │
│   ├── themes/
│   │   └── theme.ts            # Colors, spacing, typography
│   │
│   └── App.tsx                 # Pallas launcher, navigation, background worker init
│
├── app.json                    # Expo configuration
├── babel.config.js
├── eas.json                    # EAS Build configuration
├── index.ts                    # Entry point
├── package.json
├── tsconfig.json
├── AGENTS.md
├── CLAUDE.md
└── readme.md
```

## Design

Pallas uses Material 3 Expressive design principles everywhere except into the `Vade Mecum` mini-app. Vade Mecum is meant to resemble a parchament, and hence it's design is very different from the rest of the app. Aside from Vade Mecum, Material 3 Expressive is used wherever possible.

EB Garamond is used for the `Pallas` brand and tagline. 

The guiding principle is **via negativa**: remove rather than add. The design is meant to emphasize what is important and remove what is unimportant or unnecessary. 

The interface should prioritize:

* clear typography;
* direct manipulation of data;
* no unnecessary onboarding;
* no gamification;
* no social features;

Pallas is built for one person. It does not optimize for hypothetical users at the expense of simplicity.

## Development

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start
```

Run the Expo diagnostics:

```bash
npx expo-doctor
```

Build an Android APK through EAS:

```bash
eas build -p android --profile preview
```

## Philosophy

> *Via negativa.*

Pallas is not intended to record everything.

It is intended to preserve what is worth preserving, and to make the things that matter easy to act upon.

## Historical

This project was named `logfit` before being renamed. The slug needs to remain `logfit` in order to accomodate Expo.

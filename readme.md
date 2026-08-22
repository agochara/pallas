# Pallas 🦉

Pallas is a personal, offline application.

The name refers to **Pallas Athena**, associated with wisdom, strategy, and war. The connections to the Owl, to Nike, and to Odysseus are noted. 

Pallas follows a **via negativa** design philosophy: keep the system small, direct, and useful. Avoid features that do not add value.

## Structure

Pallas contains two independent modules:

* 📜 **The Study** — reading, reflection, and daily intellectual material.
* 🪽 **Askesis** — physical training and fasting.

The launcher provides access to both modules. Each module can return to the Pallas launcher.

## The Study 📜

The Study is a daily editorial page that advances automatically with the calendar.

Its content is defined in `data.ts`.

It contains:

* **To Self** — a custom daily message.
* **From The Archives** — two randomly selected aphorisms from the quote collection.
* **Tao Te Ching** — one chapter per day, progressing sequentially through the 81 chapters.

The current issue and daily state are persisted locally so that the same day's content remains stable after reopening the application.

## Askesis 🪽

Askesis is the physical-training module. It records two things: **strength and fasting**.

### Lifts

Four exercises are currently supported:

* Squat
* Bench Press
* Deadlift
* Clean & Press

Only the current maximum is stored for each exercise. No lift history is maintained.

A new record replaces the existing maximum when appropriate, while the Lifts interface also permits direct editing or clearing of a record.

### Fasting

Fasting maintains a complete history of fasting periods.

A fast can be:

* started and ended in real time;
* entered manually for a previous period;
* edited or deleted later.

The calendar displays fasting periods on a continuous weekly timeline, including fasts crossing midnight or spanning multiple days.

## Data & Persistence

Pallas currently only has offline data. 

Local persistence is handled by **SQLite** using `expo-sqlite`. There is currently no required cloud backend or account system.

The database contains:

* `max_lifts` — current maximum lift for each exercise.
* `fasts` — fasting history.
* `newsletter_settings` — The Study's persistent state and settings.

The database uses SQLite WAL mode.

The application deliberately separates **user data** from **static content**:

* SQLite stores mutable personal data.
* `data.ts` stores bundled editorial content such as quotes and the Tao Te Ching.

## Data Management

Pallas Settings provides:

* JSON export of application data.
* JSON import and merge.
* Granular deletion of lift or fasting data.
* Complete database reset.
* Direct SQLite query execution.

The SQL console allows raw `SELECT`, `INSERT`, `UPDATE`, and `DELETE` statements to be executed against the local database. This is intentional: Pallas is a personal application, so direct access to its data is preferable to building unnecessary administrative interfaces.

## Technical Stack

* **React Native**
* **Expo SDK 54**
* **TypeScript**
* **Expo SQLite**
* **Expo FileSystem / Sharing APIs**
* **React Native Safe Area Context**
* **EAS Build**

### Project structure

```textpallas/
├── assets/
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash-icon.png
│
├── src/
│   ├── askesis/
│   │   └── screens.tsx       # Askesis UI, lifts, fasting, calendar
│   │
│   ├── content/
│   │   ├── data.ts           # Static content / seed data
│   │
│   ├── database/
│   │   ├── db.ts             # SQLite database and queries
│   │   └── export.ts         # Data import/export
│   │
│   ├── settings/
│   │   └── settings-screen.tsx # SQL console, data export/import, settings
│   │
│   ├── the-study/
│   │   └── study.tsx         # The Study
│   │
│   ├── themes/
│   │   └── theme.ts          # Colors, spacing, typography
│   │
│   └── App.tsx               # Pallas launcher and navigation
│
├── app.json                  # Expo configuration
├── babel.config.js
├── eas.json                  # EAS Build configuration
├── index.ts                  # Entry point
├── package.json
├── tsconfig.json
├── AGENTS.md
├── CLAUDE.md
└── readme.md
```

## Design

Pallas uses a restrained visual system inspired by Apple's minimalist design philosophy.

The guiding principle is **via negativa**: remove rather than add.

The interface should prioritize:

* minimal navigation;
* clear typography;
* restrained use of color;
* direct manipulation of data;
* no unnecessary onboarding;
* no gamification;
* no social features;
* no cloud dependency.

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

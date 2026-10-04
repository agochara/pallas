# Pallas

Pallas is an offline, opinionated application which fulfills various functions. 

## History

Pallas was originally created as `logfit` in React Native. After being rebranded as `Pallas`, it was later migrated to use Jetpack Compose, Android Studio, and Kotlin for its development. 

## Philosophy

The Pallas name is inspired by Pallas Athena. The icon is the Owl, the creature which is sacred to Athena. 

The Pallas application follows the philosophy of `via negativa`, and does not like excessive features. It has exactly the features it needs. Pallas still likes a sleek interface—elegance and aesthetics are essential qualities. 

## Design Philosophy

The application is divided into mini-apps:

- **The Study**: For daily reflection.
- **Vade Mecum**: A no-frills infinite scrolling notebook.
- **Askesis**: Various health, fitness, and longevity features. 

Vade Mecum and the Homescreen of the Pallas application follow their own distinct style and philosophy. The Homescreen is designed to be sleek and the mini-apps are presented with elegant pictures and `Garamond` typography. The Vade Mecum mini-app is designed to look and feel like an ancient parchment, with distinct `Garamond` typography. 

The rest of the application follows Material 3 Expressive. Material 3 Expressive offers elegance as well as a great design—morphs, physics, colors, etc. 

## Mini-Apps

### The Study
A quiet daily digest for contemplation and writing:
- **Daily Editions**: Automatically generates dated issues featuring curated excerpts and quotes from classical philosophy.
- **To Self**: A private space to write reflections, intentions, or letters to oneself.

### Vade Mecum
A digital companion pocketbook inspired by traditional commonplaces:
- **Continuous Scroll**: Single infinite canvas without page breaks or folder clutter.
- **Classical Aesthetic**: Garamond typography set against warm parchment.
- **Persistent & Simple**: Auto-saves directly to local storage.

### Askesis
Named after the Greek concept of physical and spiritual discipline:
- **Strength**: Log maximum lifts and track personal records across primary compounds (Squat, Deadlift, Press, Clean, Bench, Pullups) and custom exercises.
- **Fasting**: Lightweight intermittent fasting timer.
- **Weight**: Track weight changes over time with expressive data visualization.
- **Steps & Coach**: Track daily step counts with Android Health Connect and receive local, automated coaching assessments via WorkManager.

## Architecture

- **UI**: 100% Jetpack Compose using Material 3 Expressive motions, shapes, and typography.
- **Data Persistence**: Local SQLite database (`pallas.db`) accessed via Kotlin Coroutines.
- **Background Sync**: Android WorkManager for periodic Health Connect step sync and Coach event triggers.
- **Privacy & Offline First**: Zero network permissions, no accounts, no telemetry. All user data lives exclusively on the local device.

## Building

### Prerequisites
- Android Studio Ladybug / Meerkat or later
- JDK 11 or higher
- Android SDK 33+ (Target SDK: 37)

### Build Commands
```bash
# Debug build
./gradlew assembleDebug

# Run unit tests
./gradlew test
```

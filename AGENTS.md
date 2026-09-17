# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Pallas

Pallas is an offline-first React Native/Expo application.

## Architecture

Pallas as of now has three independent modules called mini-apps:

- Study — daily editorial/intellectual material
- Vade Mecum — continuous notepad
- Askesis — health related items

SQLite is used for mutable local data.

## Design philosophy

Pallas follows via negativa:
- Keep the app small, direct, and useful.
- Avoid gamification.
- Avoid social features.
- Avoid unnecessary abstractions and complexity.
- Prefer simple, explicit code over elaborate architecture.
- Use Google's Material 3 Expressive (M3E) design language wherever possible, with the exception of Vade Mecum, which has its own design language. 

## Coding rules

- Inspect existing code and patterns before introducing a new pattern.
- Do not rewrite working code unnecessarily.
- Preserve offline functionality.
- Do not change database schemas without considering existing data and migrations.
- Before making large architectural changes, explain the proposed change first.

## Verification

After significant changes, run the relevant typecheck/lint/build checks.
Prefer targeted checks over rebuilding the entire application when possible.

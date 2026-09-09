# Dalelah Mobile

Native iOS + Android application for Dalelah, built with Expo SDK 57 and Expo Router.

## MVP screens

- Search Saudi used/new car inventory through the existing Dalelah API.
- Progressive market scan with live result counts.
- Car detail screen with original-source outbound link.
- Locally persisted Saved Cars shortlist.
- Sell My Car market valuation using Dalelah comparables.
- Seller submission deliberately disabled until Saudi-hosted data storage is configured.

## Run

```bash
cd mobile
npm install
npx expo start
```

Then open with Expo Go, iOS Simulator, or Android emulator.

## API configuration

Defaults:

- Search: `https://delilah-pm5f.onrender.com`
- Marketplace/Sell preview: `https://dalelah-sell-preview.onrender.com`

Override before build:

```bash
EXPO_PUBLIC_DALELAH_API_URL=https://api.dalelah.co
EXPO_PUBLIC_DALELAH_MARKETPLACE_URL=https://sell-api.dalelah.co
```

When Saudi production hosting is ready, only the environment values change; the app code does not need to be rebuilt around a different API contract.

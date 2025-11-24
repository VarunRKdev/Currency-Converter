 # Currency Converter

A polished Vite + React application that lets you convert money across 30+ currencies with real-time exchange rates from the Frankfurter API. It ships with a responsive UI, light/dark theming, persistent preferences, and a rolling history of your last five conversions.

## Project Structure

Currency Converter/
├── index.html
├── package.json
├── package-lock.json
├── public/
│   └── vite.svg
├── src/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts

## Features

- Live exchange rates via frankfurter.app
- Swap between 170+ currencies; common currencies preload instantly
- Amount validation with inline messaging
- Persistent preferences, theme, and conversion history (localStorage)
- Theme toggle with system preference detection
- Conversion history limited to the five most recent entries

## Getting Started

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Environment

No secrets required—the app reads public exchange data from https://api.frankfurter.app. Update `API_BASE` in `src/App.tsx` to change providers.

## Deployment

1. `npm run build`
2. Deploy the `dist/` folder to any static host.

## License

MIT (add `LICENSE` before publishing if needed).

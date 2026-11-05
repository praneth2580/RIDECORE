/**
 * RIDECORE's entry. index.html starts this instead of TrailCompass's src/main.tsx
 * (ridecore/vite-plugin.ts).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// TrailCompass's stylesheet: the map draws its markers and place popups with its classes.
import '../index.css';
import { App } from './app/App';
// Last, after MapLibre's stylesheet (imported with the map), so RIDECORE's rules win.
import './styles/ridecore.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

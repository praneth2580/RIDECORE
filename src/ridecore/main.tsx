/**
 * RIDECORE's entry. index.html starts this instead of TrailCompass's src/main.tsx
 * (ridecore/vite-plugin.ts), so what TrailCompass's entry sets up, this does too.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// TrailCompass's stylesheet: the map draws its markers and place popups with its classes.
import '../index.css';
import { App } from './app/App';
import { mapTheme } from './engine';
// Last, after MapLibre's stylesheet (imported with the map), so RIDECORE's rules win.
import './styles/ridecore.css';

// As TrailCompass's main.tsx: map colours its stylesheet draws too (the rider dot, stop icons).
const cssVars = document.documentElement.style;
cssVars.setProperty('--tc-map-rider', mapTheme.markers.rider);
cssVars.setProperty('--tc-map-rider-outline', mapTheme.markers.riderOutline);
cssVars.setProperty('--tc-map-destination', mapTheme.markers.destination);
cssVars.setProperty('--tc-map-stop', mapTheme.markers.stop);
cssVars.setProperty('--tc-map-fuel', mapTheme.places.fuel);
cssVars.setProperty('--tc-map-food', mapTheme.places.food);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

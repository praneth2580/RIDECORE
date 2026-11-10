import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';
import { mapTheme } from './theme/map-theme';

// Map colours that index.css draws too: the rider dot, the Plan tab's stop icons, traffic signals.
const cssVars = document.documentElement.style;
cssVars.setProperty('--tc-map-rider', mapTheme.markers.rider);
cssVars.setProperty('--tc-map-rider-outline', mapTheme.markers.riderOutline);
cssVars.setProperty('--tc-map-destination', mapTheme.markers.destination);
cssVars.setProperty('--tc-map-stop', mapTheme.markers.stop);
cssVars.setProperty('--tc-map-fuel', mapTheme.places.fuel);
cssVars.setProperty('--tc-map-food', mapTheme.places.food);
// The navigation banner's "signal ahead" warning draws the same traffic light.
cssVars.setProperty('--tc-map-signal-housing', mapTheme.signals.housing);
cssVars.setProperty('--tc-map-signal-red', mapTheme.signals.red);
cssVars.setProperty('--tc-map-signal-amber', mapTheme.signals.amber);
cssVars.setProperty('--tc-map-signal-green', mapTheme.signals.green);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

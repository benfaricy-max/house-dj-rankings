import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (replaces a render-blocking Google Fonts @import in index.css).
// @fontsource ships font-display:swap, so text paints immediately on the fallback.
import '@fontsource-variable/space-grotesk'   // weights 400–700 via the variable axis
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

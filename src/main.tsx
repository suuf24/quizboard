import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/* Font is bundled, not fetched from a CDN: classrooms run this on lab PCs that are offline.
   Every weight below is the Latin subset only, which covers Indonesian and the maths glyphs
   a quiz actually uses (x, degree, plus-minus). Missing glyphs fall back per character. */
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-500.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import '@fontsource/space-mono/latin-400.css'
import '@fontsource/space-mono/latin-700.css'

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

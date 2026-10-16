import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.jsx'

// Les balises data-fallback de index.html servent aux robots qui n'exécutent pas le JS.
// Une fois React lancé, chaque page met les siennes : on enlève les doublons
document.querySelectorAll('[data-fallback]').forEach((el) => el.remove())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

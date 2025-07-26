import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ECDHExample from './components/ECDHExample.jsx'
import SecureChatApp from './components/SecureChatApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <ECDHExample /> */}
    <SecureChatApp />
  </StrictMode>,
)
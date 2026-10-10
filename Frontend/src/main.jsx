import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from "react-router-dom"
import { router } from "./app.router"
import { AuthProvider } from "./features/auth/auth.context.jsx"
import ServerWakeNotice from "./components/ServerWakeNotice"
import "./style.scss"

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
      <ServerWakeNotice />
    </AuthProvider>
  </StrictMode>
)

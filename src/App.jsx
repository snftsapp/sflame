import { BrowserRouter, Route, Routes } from "react-router-dom"
import { ReactLenis } from "lenis/react"
import { AuthProvider } from "./auth"
import { GameProvider } from "./state"
import { Shell } from "./components/Shell"
import Dashboard from "./pages/Dashboard"
import Flame from "./pages/Flame"
import Home from "./pages/Home"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GameProvider>
          <ReactLenis root options={{ lerp: 0.085, smoothWheel: true }}>
            <Shell>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/flame" element={<Flame />} />
                <Route path="/dashboard" element={<Dashboard />} />
              </Routes>
            </Shell>
          </ReactLenis>
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

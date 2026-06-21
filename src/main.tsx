
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { StrictMode } from 'react'

// Create a container to render our app
const container = document.getElementById("root")

// Basic error handling
if (!container) {
  console.error("Failed to find the root element")
  document.body.innerHTML = '<div style="color: red; padding: 20px;">Could not find root element</div>'
} else {
  const root = createRoot(container)
  
  try {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
    console.log("App rendered successfully")
  } catch (error) {
    console.error("Failed to render the app:", error)
    root.render(
      <div style={{ color: "red", padding: "20px" }}>
        Error rendering application. Please check the console for details.
      </div>
    )
  }
}

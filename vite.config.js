import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // --- THE COMPLETE SERVER SECTION ---
  server: {
    headers: {
      'Content-Security-Policy': 
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "connect-src 'self' https://api.razorpay.com https://identitytoolkit.googleapis.com; " +
        "frame-src https://api.razorpay.com;"
    }
  }
  // ----------------------------------
})
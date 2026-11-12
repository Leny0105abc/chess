import { defineConfig } from '@playwright/test'
const installed=process.env.PLAYWRIGHT_CHROME
export default defineConfig({
  testDir:'./tests/browser',
  timeout:45_000,
  use:{hasTouch:true,baseURL:'http://127.0.0.1:4173',launchOptions:installed?{executablePath:installed}:{}},
  webServer:{command:'npm run preview -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
})

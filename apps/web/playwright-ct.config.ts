import { defineConfig, devices } from '@playwright/experimental-ct-react'

const VIEWPORTS = {
  mobile: { width: 375, height: 700 },
  tablet: { width: 700, height: 800 },
  desktop: { width: 1280, height: 900 },
}

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.ct.tsx',
  snapshotDir: './__snapshots__',
  timeout: 10_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'on-first-retry',
    ctPort: 3101,
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.mobile } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.tablet } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.desktop } },
  ],
})

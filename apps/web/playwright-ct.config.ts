import { defineConfig, devices } from '@playwright/experimental-ct-react'
import path from 'path'

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
    ctViteConfig: {
      resolve: {
        alias: {
          'next/navigation': path.resolve(__dirname, 'playwright/next-navigation-mock.ts'),
        },
      },
      define: {
        'process.env': JSON.stringify({
          NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
          NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
          NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: '',
        }),
      },
    },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.mobile } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.tablet } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.desktop } },
  ],
})

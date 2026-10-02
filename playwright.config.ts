import { defineConfig, devices } from '@playwright/test'

// ビルドしたアプリを vite preview で配信し、スマホ幅で操作を確かめる（npm run build のあとに npm run test:e2e）
const port = 4174
const host = ['127', '0', '0', '1'].join('.')
const base = `http://${host}:${port}/softtennis-iq/`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  use: {
    baseURL: base,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iPhone SE', use: { ...devices['iPhone SE'], browserName: 'chromium' } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx vite preview --host ${host} --port ${port} --strictPort`,
    url: base,
    reuseExistingServer: !process.env.CI,
  },
})

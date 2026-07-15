import { test, expect } from '@playwright/experimental-ct-react'
import { TopNav } from './TopNav'
import { ThemeProvider } from '../contexts/ThemeContext'
import { AssistantProvider } from '../contexts/AssistantContext'

test('TopNav mobile nav (segunda linha) é scrollável, não corta o layout e mostra affordance de scroll', async (
  { mount, page },
  testInfo
) => {
  const viewportWidth = page.viewportSize()?.width ?? 0
  test.skip(viewportWidth >= 1024, 'a segunda linha de navegação só renderiza abaixo do breakpoint lg (1024px)')

  // TopNav renderiza <SelfieToggle>, que lê useSelfieDismissal() (precisa de
  // AssistantProvider) mesmo fora do breakpoint mobile — a barra de topo com
  // o botão do Selfie sempre existe no DOM, só fica escondida por CSS.
  const component = await mount(
    <ThemeProvider>
      <AssistantProvider>
        <TopNav email="user@example.com" onLogout={() => {}} />
      </AssistantProvider>
    </ThemeProvider>
  )
  const nav = component.locator('nav.overflow-x-auto')

  const metrics = await nav.evaluate((el) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    right: el.getBoundingClientRect().right,
  }))

  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
  expect(metrics.right).toBeLessThanOrEqual(viewportWidth + 1)
  await expect(component.locator('.lucide-chevron-right')).toBeVisible()

  await expect(component).toHaveScreenshot()
})

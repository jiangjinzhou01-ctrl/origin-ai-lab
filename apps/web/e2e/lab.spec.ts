import { test as base, expect, type Page } from '@playwright/test'
import fixture from '../public/data/language.json' with { type: 'json' }

type QA = { expectedApiFailure: boolean; quality: void }
const test = base.extend<QA>({
  expectedApiFailure: [false, { option: true }],
  quality: [
    async ({ page, expectedApiFailure }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`))
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return
        if (expectedApiFailure && /\/api\/(health|analyze)/.test(msg.location().url)) return
        errors.push(`console: ${msg.text()}`)
      })
      page.on('requestfailed', (request) => {
        if (expectedApiFailure && /\/api\/(health|analyze)/.test(request.url())) return
        if (request.failure()?.errorText === 'net::ERR_ABORTED') return // navigation can cancel an old asset fetch
        errors.push(`resource: ${request.url()} ${request.failure()?.errorText}`)
      })
      await use()
      expect(errors, 'browser console and resource failures').toEqual([])
    },
    { auto: true },
  ],
})

async function enter(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('button', { name: '探索模型', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '探索模型', exact: true }).click()
  await expect(page.getByTestId('matrix-label')).toContainText('L0 / H0')
}
async function noOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(sizes.doc).toBeLessThanOrEqual(sizes.viewport + 1)
}

test('static core works without a Python service; selections use the actual tensor', async ({
  page,
}, info) => {
  const apiRequests: string[] = []
  await page.route('**/api/**', (route) => {
    apiRequests.push(route.request().url())
    return route.abort()
  })
  await enter(page)
  await page.getByLabel('选择 Layer', { exact: true }).selectOption('5')
  await page.getByLabel('选择 Head', { exact: true }).selectOption('7')
  await expect(page.getByTestId('matrix-label')).toContainText('L5 / H7')
  const value = fixture.attention.values[5]![7]![4]![0]!.toFixed(8)
  await expect(page.getByTestId('cell-4-0')).toHaveAttribute('data-value', value)
  await expect(page.getByTestId('attention-value')).toHaveText(value)
  await page.getByRole('button', { name: '选择 Token 1: ␠cat', exact: true }).click()
  await expect(page.getByLabel('选择 Query Token', { exact: true })).toHaveValue('1')
  await page.getByLabel('选择 Key Token', { exact: true }).selectOption('4')
  await expect(page.getByText('Causal Mask · 未来位置不可访问')).toBeVisible()
  await page.getByLabel('选择预计算实验').selectOption('intelligence')
  await expect(page.getByLabel('选择 Query Token', { exact: true })).toHaveValue('3')
  await expect(page.getByTestId('matrix-label')).toContainText('4 × 4')
  await page.getByText('数据来源与可复现性', { exact: false }).click()
  await expect(
    page.getByText('607a30d783dfa663caf39e06633721c8d4cfcd7e', { exact: true }).last(),
  ).toBeVisible()
  expect(apiRequests).toEqual([])
  await noOverflow(page)
  await page.screenshot({ path: `../../docs/explore-${info.project.name}.png`, fullPage: true })
})

test('token details, associations and predictions retain scientific labels', async ({ page }) => {
  await enter(page)
  await page.getByRole('tab', { name: 'Token 详情' }).click()
  await expect(page.getByText('UTF-8 字节（Hex）', { exact: true })).toBeVisible()
  await expect(page.getByText('262', { exact: true }).last()).toBeVisible()
  await page.getByRole('tab', { name: 'Attention', exact: true }).click()
  await page.getByRole('button', { name: '关联连线视图' }).click()
  await expect(page.getByRole('group', { name: '同一 Attention 行的关联连线' })).toBeVisible()
  await page.getByRole('button', { name: '矩阵视图' }).click()
  await expect(page.getByTestId('attention-value')).toHaveText(
    fixture.attention.values[0]![0]![4]![0]!.toFixed(8),
  )
  const panel = page.getByRole('button', { name: '预测与模型信息', exact: true })
  if (await panel.isVisible()) {
    await panel.click()
    await expect(panel).toHaveAttribute('aria-expanded', 'true')
  }
  await page.getByText('查看 Logits 与候选 ID', { exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Logit', exact: true })).toBeVisible()
})

test('architecture and recorded playback share the selected layer', async ({ page }) => {
  await enter(page)
  await page.getByRole('tab', { name: '推理回放' }).click()
  await page.getByRole('slider', { name: '回放步骤定位' }).fill('10')
  await expect(page.getByTestId('playback-step')).toHaveText('L4 · Attention')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByTestId('playback-step')).toHaveText('L4 · Residual')
  await page.getByRole('button', { name: '播放回放', exact: true }).click()
  await page.getByRole('button', { name: '暂停回放', exact: true }).click()
  await page.getByRole('button', { name: '重置回放', exact: true }).click()
  await expect(page.getByTestId('playback-step')).toHaveText('Tokenization')
  await page.getByRole('link', { name: '模型架构', exact: true }).click()
  await page.getByLabel('选择 Layer', { exact: true }).selectOption('7')
  await page.getByRole('button', { name: '检查此层的 Attention', exact: true }).click()
  await expect(page.getByTestId('matrix-label')).toContainText('L7 / H0')
  await noOverflow(page)
})

test('WebGL unavailable and reduced motion preserve keyboard analysis', async ({ page }) => {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null
      return Reflect.apply(native, this, [type, ...args])
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enter(page)
  await expect(page.getByRole('button', { name: '降低动态效果' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const panel = page.getByRole('button', { name: '预测与模型信息', exact: true })
  if (await panel.isVisible()) await panel.click()
  await expect(page.getByRole('group', { name: 'GPT-2 完整架构二维示意图' })).toBeVisible()
  const token = page.getByRole('button', { name: '选择 Token 2: ␠sat' })
  await token.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('选择 Query Token', { exact: true })).toHaveValue('2')
  await expect(token).toBeFocused()
  await page.getByRole('button', { name: '查看 Transformer Block 3', exact: true }).click()
  await expect(page.getByTestId('matrix-label')).toContainText('L3 / H0')
  await noOverflow(page)
})

test.describe('backend connection failure', () => {
  test.use({ expectedApiFailure: true })
  test('never displays a successful inference and can restore static mode', async ({ page }) => {
    await page.route('**/api/**', (route) => route.abort('connectionrefused'))
    await enter(page)
    await page.getByRole('button', { name: '实时分析', exact: true }).click()
    await page.getByLabel('输入文本', { exact: false }).fill('A brand new input')
    await page.getByRole('button', { name: '运行分析', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('当前输入未进行推理')
    await expect(page.getByText(/下方保留的是上一次预计算实验结果/)).toBeVisible()
    await expect(page.getByTestId('attention-value')).toHaveText(
      fixture.attention.values[0]![0]![4]![0]!.toFixed(8),
    )
    await page.getByRole('button', { name: '使用预计算实验', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByLabel('选择预计算实验')).toBeVisible()
  })
})

test('real live GPT-2 inference updates every view', async ({ page, request }) => {
  test.skip(!process.env.ORIGIN_LIVE_TEST, 'Run explicitly with a ready real model API')
  const health = await request.get('http://127.0.0.1:8000/api/health')
  expect((await health.json()).model_ready).toBe(true)
  await enter(page)
  await page.getByRole('button', { name: '实时分析', exact: true }).click()
  await page.getByLabel('输入文本', { exact: false }).fill('The moon is')
  const pending = page.waitForResponse('**/api/analyze')
  await page.getByRole('button', { name: '运行分析', exact: true }).click()
  const response = await pending
  expect(response.ok()).toBe(true)
  const result = await response.json()
  expect(result.source_mode).toBe('live')
  expect(result.runtime.backend).toBe('transformer_lens.TransformerBridge')
  expect(result.input.text).toBe('The moon is')
  await expect(page.getByTestId('matrix-label')).toContainText(
    `${result.tokens.length} × ${result.tokens.length}`,
  )
  await expect(page.getByTestId('attention-value')).toHaveText(
    result.attention.values[0][0][result.tokens.length - 1][0].toFixed(8),
  )
  await page.getByRole('tab', { name: 'Token 详情' }).click()
  await expect(page.locator('blockquote')).toHaveText('The moon is')
})

test('64-token live experiment uses an exact selectable Canvas matrix', async ({ page }) => {
  test.skip(!process.env.ORIGIN_LIVE_TEST, 'Requires actual model API')
  await enter(page)
  await page.getByRole('button', { name: '实时分析', exact: true }).click()
  await page.getByLabel('输入文本', { exact: false }).fill(' word'.repeat(64))
  await page.getByRole('button', { name: '运行分析', exact: true }).click()
  await expect(page.getByTestId('matrix-label')).toContainText('64 × 64')
  await expect(page.getByRole('img', { name: /Attention Matrix Layer 0 Head 0/ })).toBeVisible()
  await page.getByLabel('选择 Query Token', { exact: true }).selectOption('2')
  await page.getByLabel('选择 Key Token', { exact: true }).selectOption('63')
  await expect(page.getByTestId('attention-value')).toHaveText('0.00000000')
  await expect(page.getByText('Causal Mask · 未来位置不可访问')).toBeVisible()
  await noOverflow(page)
})

import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'

const url = process.env.ORIGIN_TEST_URL || 'http://127.0.0.1:4180/origin-ai-lab/'
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
  args: ['--no-sandbox'],
})
const report = {
  url,
  browser: browser.version(),
  environment:
    'Managed Linux, Chromium headless. Mobile is viewport/touch emulation on the same CPU, not a physical device. No network/CPU throttling. Times include Playwright round trips; no FPS claim.',
  measurements: [],
}
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    })
    await page.addInitScript(() => {
      window.originQAFrames = 0
      window.originQADraws = 0
      if (window.WebGL2RenderingContext)
        for (const name of [
          'drawArrays',
          'drawElements',
          'drawArraysInstanced',
          'drawElementsInstanced',
        ]) {
          const original = WebGL2RenderingContext.prototype[name]
          WebGL2RenderingContext.prototype[name] = function (...args) {
            window.originQADraws++
            return Reflect.apply(original, this, args)
          }
        }
      const raf = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (callback) =>
        raf((time) => {
          window.originQAFrames++
          callback(time)
        })
    })
    const start = performance.now()
    await page.goto(url)
    await page.getByRole('button', { name: '探索模型', exact: true }).waitFor()
    const readyMs = performance.now() - start
    await page.waitForTimeout(4000)
    const initial = await page.evaluate(() => window.originQAFrames)
    const initialDraws = await page.evaluate(() => window.originQADraws)
    await page.waitForTimeout(2000)
    const idleFrames = (await page.evaluate(() => window.originQAFrames)) - initial
    const idleDraws = (await page.evaluate(() => window.originQADraws)) - initialDraws
    const resources = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((r) => ({ url: r.name, bytes: r.encodedBodySize })),
    )
    const spatialRequested = resources.some((r) => r.url.includes('SpatialScene'))
    const paints = await page.evaluate(() =>
      performance.getEntriesByType('paint').map((e) => ({ name: e.name, ms: e.startTime })),
    )
    await page.screenshot({
      path: `docs/home-${mobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: '探索模型', exact: true }).click()
    const switchMs = []
    for (const i of [2, 5, 7, 9, 11]) {
      const t = performance.now()
      await page.getByLabel('选择 Layer', { exact: true }).selectOption(`${i}`)
      await page.getByLabel('选择 Head', { exact: true }).selectOption(`${i}`)
      await page
        .getByTestId('matrix-label')
        .filter({ hasText: `L${i} / H${i}` })
        .waitFor()
      switchMs.push(performance.now() - t)
    }
    let memory = null
    if (!mobile) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Performance.enable')
      await cdp.send('HeapProfiler.collectGarbage')
      const before = (await cdp.send('Performance.getMetrics')).metrics.find(
        (m) => m.name === 'JSHeapUsedSize',
      ).value
      for (let i = 0; i < 5; i++) {
        await page.getByRole('link', { name: '模型架构', exact: true }).click()
        await page.getByRole('heading', { name: '结构，为计算提供路径。', exact: true }).waitFor()
        await page.getByRole('link', { name: 'ORIGIN 首页', exact: true }).click()
        await page.getByRole('button', { name: '探索模型', exact: true }).waitFor()
        await page.getByRole('button', { name: '探索模型', exact: true }).click()
      }
      await page.waitForTimeout(2200)
      await cdp.send('HeapProfiler.collectGarbage')
      const after = (await cdp.send('Performance.getMetrics')).metrics.find(
        (m) => m.name === 'JSHeapUsedSize',
      ).value
      memory = {
        before_mb: before / 2 ** 20,
        after_5_navigation_cycles_mb: after / 2 ** 20,
        delta_mb: (after - before) / 2 ** 20,
        note: 'Short regression check after GC, not a proof of absence of long-term leaks.',
      }
    }
    report.measurements.push({
      viewport: mobile ? '390 × 844, touch' : '1440 × 1000',
      home_interactive_ms: readyMs,
      paints,
      spatial_chunk_requested: spatialRequested,
      idle_raf_callbacks_in_2_seconds: idleFrames,
      idle_webgl_draw_calls_in_2_seconds: idleDraws,
      layer_and_head_switch_ms: switchMs,
      median_switch_ms: [...switchMs].sort((a, b) => a - b)[2],
      memory,
    })
    console.log(report.measurements.at(-1))
    await page.close()
  }
  await fs.writeFile('docs/web-performance.json', JSON.stringify(report, null, 2) + '\n')
} finally {
  await browser.close()
}

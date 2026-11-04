import { expect, it } from 'vitest'
import { attentionColor, attentionTextColor } from './AttentionMatrix'

it('keeps cell text contrast at least 4.5 across the full probability color scale', () => {
  for (let i = 0; i <= 100; i++) {
    const p = i / 100
    const rgb = attentionColor(p).match(/\d+/g)!.map(Number)
    const linear = rgb.map((c) => {
      const s = c / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    const bg = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
    const fg = attentionTextColor(p) === '#ffffff' ? 1 : 0
    const contrast = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05)
    expect(contrast).toBeGreaterThanOrEqual(4.5)
  }
})

import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/language.json'
import { validateAnalysis } from '../../data/client'
import { useLab } from '../../store/lab'
import { InferenceObservatory } from './InferenceObservatory'

vi.mock('../architecture/SceneViewport', () => ({
  SceneViewport: () => <div>Semantic structure</div>,
}))
const data = validateAnalysis(fixture)
beforeEach(() => useLab.setState({ analysis: data, layer: 0, query: 4, step: 0, playing: false }))
it('supports navigation, seek and reset with accurate recorded caption', () => {
  render(<InferenceObservatory data={data} />)
  expect(screen.getByText(/动画间隔不是模型执行耗时/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '下一步' }))
  expect(screen.getByTestId('playback-step')).toHaveTextContent('Embedding')
  expect(
    screen.getByText(
      `${data.activation_summaries[0]!.rms[4]!.toFixed(5)} / ${data.activation_summaries[1]!.rms[4]!.toFixed(5)}`,
    ),
  ).toBeVisible()
  fireEvent.change(screen.getByLabelText('回放步骤定位'), { target: { value: '10' } })
  expect(useLab.getState().layer).toBe(4)
  fireEvent.click(screen.getByRole('button', { name: '重置回放' }))
  expect(screen.getByTestId('playback-step')).toHaveTextContent('Tokenization')
})
it('plays, pauses and releases the playback timer on unmount', () => {
  vi.useFakeTimers()
  const result = render(<InferenceObservatory data={data} />)
  fireEvent.click(screen.getByRole('button', { name: '播放回放' }))
  act(() => vi.advanceTimersByTime(1300))
  expect(useLab.getState().step).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: '暂停回放' }))
  act(() => vi.advanceTimersByTime(2600))
  expect(useLab.getState().step).toBe(1)
  result.unmount()
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
})

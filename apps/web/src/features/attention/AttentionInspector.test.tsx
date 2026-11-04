import { beforeEach, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import fixture from '../../../public/data/language.json'
import { validateAnalysis } from '../../data/client'
import { useLab } from '../../store/lab'
import { AttentionInspector } from './AttentionInspector'
import { TokenRail } from '../explorer/TokenRail'
import { Predictions } from '../explorer/Predictions'

const data = validateAnalysis(fixture)
beforeEach(() => useLab.setState({ analysis: data, layer: 0, head: 0, query: 4, key: 0 }))
it('updates actual matrix labels and data across layer and head', () => {
  render(<AttentionInspector data={data} />)
  fireEvent.change(screen.getByLabelText('选择 Layer'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('选择 Head'), { target: { value: '7' } })
  expect(screen.getByTestId('matrix-label')).toHaveTextContent('L5 / H7')
  expect(screen.getByTestId('cell-4-0')).toHaveAttribute(
    'data-value',
    data.attention.values[5]![7]![4]![0]!.toFixed(8),
  )
  expect(screen.getByTestId('attention-value')).toHaveTextContent(
    data.attention.values[5]![7]![4]![0]!.toFixed(8),
  )
})
it('selects query/key and explicitly identifies masked future positions', () => {
  render(<AttentionInspector data={data} />)
  fireEvent.click(screen.getByTestId('cell-1-3'))
  expect(useLab.getState()).toMatchObject({ query: 1, key: 3 })
  expect(screen.getByTestId('attention-value')).toHaveTextContent('0.00000000')
  expect(screen.getByText('Causal Mask · 未来位置不可访问')).toBeVisible()
  fireEvent.keyDown(screen.getByTestId('cell-1-3'), { key: 'ArrowLeft' })
  expect(useLab.getState().key).toBe(2)
  expect(screen.getByTestId('cell-1-2')).toHaveFocus()
  fireEvent.keyDown(screen.getByTestId('cell-1-2'), { key: 'ArrowLeft' })
  expect(useLab.getState().key).toBe(1)
})
it('links token selection to predictions and attention', () => {
  render(
    <>
      <TokenRail data={data} />
      <AttentionInspector data={data} />
      <Predictions data={data} />
    </>,
  )
  fireEvent.click(screen.getByRole('button', { name: '选择 Token 1: ␠cat' }))
  expect(screen.getByLabelText('选择 Query Token')).toHaveValue('1')
  expect(screen.getByText(/在位置 1 之后/)).toBeVisible()
  expect(screen.getByText('blocks.0.attn.hook_pattern · float32')).toBeVisible()
})
it('association threshold does not change source values', () => {
  render(<AttentionInspector data={data} />)
  const raw = JSON.stringify(data.attention.values)
  fireEvent.click(screen.getByRole('button', { name: '关联连线视图' }))
  fireEvent.change(screen.getByLabelText('连线显示阈值'), { target: { value: '1' } })
  expect(JSON.stringify(data.attention.values)).toBe(raw)
})

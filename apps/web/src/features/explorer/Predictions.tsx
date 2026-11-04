import { ArrowDownRight } from 'lucide-react'
import type { Analysis } from '../../data/analysis.generated'
import { useLab } from '../../store/lab'
import { percent } from '../../components/Primitives'

export function Predictions({ data }: { data: Analysis }) {
  const query = useLab((s) => s.query)
  const prediction = data.next_token_predictions.by_position[query]!
  const first = prediction.candidates[0]!.probability
  return (
    <section className="prediction-panel" aria-label="下一 Token 预测">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Next-token prediction</span>
          <h3>接下来，可能是什么？</h3>
        </div>
        <ArrowDownRight size={22} strokeWidth={1} />
      </div>
      <p className="small muted">
        在位置 {query} 之后，仅使用 0–{query} 的上下文。完整词表 Softmax，温度为 1。
      </p>
      <ol className="prediction-list">
        {prediction.candidates.map((c, i) => (
          <li key={c.id}>
            <span className="prediction-rank">{String(i + 1).padStart(2, '0')}</span>
            <div className="prediction-word">
              <code>{c.display || '∅'}</code>
              <span
                className="prediction-bar"
                style={{ width: `${(100 * c.probability) / first}%` }}
              />
            </div>
            <span className="prediction-probability">{percent(c.probability)}</span>
            <span className="sr-only">
              Token ID {c.id}，Logit {c.logit.toFixed(5)}
            </span>
          </li>
        ))}
      </ol>
      <div className="prediction-remainder">
        <span>其余 {data.model.vocab_size - prediction.candidates.length} 个候选</span>
        <span>{percent(prediction.remaining_probability)}</span>
      </div>
      <details className="compact-details">
        <summary>查看 Logits 与候选 ID</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">ID</th>
                <th scope="col">Logit</th>
                <th scope="col">概率</th>
              </tr>
            </thead>
            <tbody>
              {prediction.candidates.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code>{c.display}</code>
                  </td>
                  <td>{c.id}</td>
                  <td>{c.logit.toFixed(5)}</td>
                  <td>{percent(c.probability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Logit 是未归一化分数。条形长度相对于当前 Top-1；数值始终是完整词表中的真实概率。
        </p>
      </details>
    </section>
  )
}

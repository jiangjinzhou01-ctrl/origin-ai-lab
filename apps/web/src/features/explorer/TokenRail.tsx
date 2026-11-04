import type { Analysis } from '../../data/analysis.generated'
import { useLab } from '../../store/lab'
import { Braces, ChevronRight } from 'lucide-react'

export function TokenRail({ data }: { data: Analysis }) {
  const query = useLab((s) => s.query),
    setQuery = useLab((s) => s.setQuery)
  return (
    <section className="token-section" aria-label="Token Explorer">
      <div className="token-rail-title">
        <span>
          <Braces size={15} />
          模型实际接收的 Token
        </span>
        <span className="small muted">选择 Query · 位置从 0 开始</span>
      </div>
      <div className="token-rail">
        {data.tokens.map((token) => (
          <button
            key={token.position}
            className={`token-chip ${query === token.position ? 'selected' : ''}`}
            onClick={() => setQuery(token.position)}
            aria-pressed={query === token.position}
            aria-label={`选择 Token ${token.position}: ${token.display}`}
          >
            <span className="token-position">{String(token.position).padStart(2, '0')}</span>
            <strong>{token.display || '∅'}</strong>
            <span className="token-id">
              {token.id}
              {token.is_special ? ' · 特殊' : ''}
            </span>
          </button>
        ))}
      </div>
      <p className="token-note">
        <span className="mono">␠</span> 空格 <span className="mono">↵</span> 换行{' '}
        <span className="mono">⇥</span> Tab
        <ChevronRight size={12} />
        Byte-level BPE，Token 不等于单词；未自动添加 BOS。
      </p>
    </section>
  )
}

export function TokenDetails({ data }: { data: Analysis }) {
  const query = useLab((s) => s.query)
  const t = data.tokens[query]!
  return (
    <div className="token-detail-grid">
      <article className="input-document">
        <span className="eyebrow">原始输入 · 未截断</span>
        <blockquote>{data.input.text}</blockquote>
        <p>
          {data.input.sequence_length} 个 Token · {new TextEncoder().encode(data.input.text).length}{' '}
          UTF-8 字节
        </p>
      </article>
      <article className="token-record">
        <h3>
          Token {t.position}
          <span className="muted"> / 实际序列位置</span>
        </h3>
        <dl className="data-list">
          <div>
            <dt>Token ID</dt>
            <dd className="large-number">{t.id}</dd>
          </div>
          <div>
            <dt>解码字符串</dt>
            <dd>
              <code>{JSON.stringify(t.text)}</code>
            </dd>
          </div>
          <div>
            <dt>原始 BPE 片段</dt>
            <dd>
              <code>{t.raw_piece}</code>
            </dd>
          </div>
          <div>
            <dt>UTF-8 字节（Hex）</dt>
            <dd>
              <code>{t.byte_hex}</code>
            </dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd>{t.is_special ? '特殊 Token' : '用户文本 Token'}</dd>
          </div>
        </dl>
        <p className="small muted">
          单个 Token 的字节可能不是完整 UTF-8
          字符；独立解码时可出现替代字符。完整序列的字节拼接已验证等于输入。
        </p>
      </article>
    </div>
  )
}

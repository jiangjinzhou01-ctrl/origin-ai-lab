import { Check, Copy, Download, ExternalLink, Fingerprint } from 'lucide-react'
import { useState } from 'react'
import type { Analysis } from '../data/analysis.generated'
import { tensor } from './Primitives'

export function Provenance({ data }: { data: Analysis }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${data.analysis_id}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(data.provenance.tensor_sha256)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }
  return (
    <details className="provenance-panel">
      <summary>
        <Fingerprint size={16} />
        数据来源与可复现性<span className="verified">真实模型 · 已校验</span>
      </summary>
      <div className="provenance-body">
        <dl className="data-list">
          <div>
            <dt>数据来源</dt>
            <dd>
              {data.source_mode === 'static'
                ? '真实前向计算 · 预计算实验'
                : '真实前向计算 · 实时 API'}
            </dd>
          </div>
          <div>
            <dt>模型</dt>
            <dd>{data.model.id}</dd>
          </div>
          <div>
            <dt>权重 / Tokenizer Revision</dt>
            <dd className="hash-value">{data.model.revision}</dd>
          </div>
          <div>
            <dt>计算后端</dt>
            <dd>{data.runtime.backend}</dd>
          </div>
          <div>
            <dt>Attention 张量</dt>
            <dd>{tensor(data.attention.shape)} · [Layer, Head, Query, Key]</dd>
          </div>
          <div>
            <dt>计算配置</dt>
            <dd>{data.runtime.device} · float32 · eager · eval · 无梯度 · BOS 未插入</dd>
          </div>
          <div>
            <dt>记录耗时</dt>
            <dd>
              前向 {data.runtime.inference_ms.toFixed(1)} ms / 序列化与校验{' '}
              {data.runtime.serialization_ms.toFixed(1)} ms
              {data.runtime.cache_hit ? ' · 本次命中内存缓存' : ''}
            </dd>
          </div>
          <div>
            <dt>数据精度</dt>
            <dd>Attention 保留 8 位小数，未做行重归一化。</dd>
          </div>
          <div>
            <dt>生成时间</dt>
            <dd>{data.provenance.generated_at}</dd>
          </div>
          <div>
            <dt>分析代码</dt>
            <dd>
              {data.provenance.analysis_code_version}
              <code className="hash-value">{data.provenance.analysis_code_sha256}</code>
            </dd>
          </div>
          <div>
            <dt>Python 依赖</dt>
            <dd>
              {Object.entries(data.provenance.dependencies).map(([k, v]) => (
                <code key={k}>
                  {k} {v}{' '}
                </code>
              ))}
            </dd>
          </div>
          <div>
            <dt>原始张量 SHA-256</dt>
            <dd className="hash-value">{data.provenance.tensor_sha256}</dd>
          </div>
        </dl>
        <p className="muted small">
          校验包括维度、有限数值、行概率和、因果遮罩、预测概率质量、L2/RMS
          定义及输入字节重建。原始张量哈希需使用固定依赖重新计算验证。
        </p>
        <div className="button-row">
          <button className="button small-button" onClick={download}>
            <Download size={15} />
            导出实验 JSON
          </button>
          <button className="button small-button" onClick={() => void copy()}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? '已复制校验和' : '复制校验和'}
          </button>
          <a
            className="text-link"
            href={`https://huggingface.co/${data.model.id}/tree/${data.model.revision}`}
            target="_blank"
            rel="noreferrer"
          >
            查看权重来源
            <ExternalLink size={13} />
          </a>
        </div>
        {copyError && <p role="status">浏览器不支持复制，请从上方选择校验和。</p>}
      </div>
    </details>
  )
}

import type { Analysis } from '../data/analysis.generated'
import { Provenance } from './Provenance'
import { Eyebrow } from './Primitives'

export function About({ data }: { data: Analysis }) {
  return (
    <main className="about-page page-shell">
      <div className="page-intro">
        <Eyebrow number="03">About ORIGIN</Eyebrow>
        <h1>
          探索智能，
          <br />
          也尊重未知。
        </h1>
        <p>
          ORIGIN 是一个交互式智能实验室。让一个真实 Transformer
          的可观测计算，成为可以触摸的科学材料。
        </p>
      </div>
      <section className="about-method">
        <div>
          <Eyebrow>Research specimen</Eyebrow>
          <h2>为什么是 GPT-2？</h2>
        </div>
        <div>
          <p>
            GPT-2 Small 是一个公开、成熟、可在 CPU 上运行的 Decoder-only
            Transformer。它的体量适合反复检查，也有丰富的研究资料。
          </p>
          <p>
            它在这里是理解 Transformer 的研究样本，不代表现代最先进模型的能力。我们使用{' '}
            {data.model.id}，固定精确 Revision；结构数字来自实际加载的配置。
          </p>
        </div>
      </section>
      <section className="about-boundaries">
        <Eyebrow>What the measurements mean</Eyebrow>
        <h2>观察，需要精确的语言。</h2>
        <div className="boundary-list">
          {[
            [
              'Attention',
              'QKᵀ/√d 经因果遮罩与 Softmax 后的权重。行是 Query，列是 Key；每行的可访问概率和约为 1。注意力权重不能单独证明某个 Token 是预测的因果原因。',
            ],
            [
              'Residual Stream',
              '各 Block 在 MLP 残差相加后的输出向量。L2 = √Σxᵢ²，RMS = √(Σxᵢ²/d)，沿隐藏维度测量。它们是幅度统计，不是“理解程度”。',
            ],
            [
              'Logits & Probability',
              'Logit 是输出投影得到的未归一化分数。对完整词表做 Softmax（温度 1）才得到概率。Top-K 没有重新归一化，未显示候选的质量会单独列出。',
            ],
            [
              'Architecture',
              '空间节点表示组件与数据单元，不表示单个神经元或所有参数。连线展示计算依赖，几何形状没有物理含义；前向计算也不等于人类思考。',
            ],
            [
              'Recorded playback',
              '每次前向计算先完整执行，再按步骤回放采集的记录。动效用于表达关系，时间间隔不对应模型的真实逐层耗时。',
            ],
            [
              'Static & Live',
              '预计算实验来自真实模型，可离线于 Python 服务使用。实时分析会向配置的 FastAPI 提交新文本。服务不可用时不生成新结果，已有记录会清楚标注。',
            ],
          ].map(([term, explanation]) => (
            <article key={term}>
              <h3>{term}</h3>
              <p>{explanation}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="about-glossary">
        <h2>从这些术语开始</h2>
        <dl>
          <div>
            <dt>Token</dt>
            <dd>Byte-level BPE 的编码单元；可能是词、词的一部分、空格或字符的部分字节。</dd>
          </div>
          <div>
            <dt>Query / Key / Value</dt>
            <dd>当前位置的查询、可匹配的位置表示、以及按注意力权重聚合的内容向量。</dd>
          </div>
          <div>
            <dt>Causal Mask</dt>
            <dd>将未来 Key 位置屏蔽，保证位置 q 的输出只能依赖位置 0 到 q。</dd>
          </div>
          <div>
            <dt>LayerNorm / MLP</dt>
            <dd>前者沿隐藏维度归一化向量，后者通过两次线性投影和非线性激活变换每个位置的向量。</dd>
          </div>
        </dl>
      </section>
      <Provenance data={data} />
    </main>
  )
}

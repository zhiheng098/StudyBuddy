/* ============================================================
   StudyBuddy · 首次运行示例资料
   让访客打开就能看到完整的产品形态，而不必先上传文件。
   ============================================================ */

import { db, uid } from './db'
import { buildChunks } from './parse'

const SAMPLE = `# 注意力机制与 Transformer 入门

## 1. 为什么需要注意力机制

在循环神经网络（RNN）中，要利用序列 $X = [x_1, x_2, \\dots, x_n]$ 中相距很远的信息，必须沿着时间步逐步传递。这带来两个问题：

- **时间步上的梯度消失**：反向传播时梯度要连乘 $n$ 次，链式法则导致早期位置几乎收不到梯度信号。
- **无法并行**：$h_t$ 的计算依赖 $h_{t-1}$，训练时无法把所有位置并行处理。

自注意力（Self-Attention）打破了这一限制：每个位置**直接**与所有位置计算相关性，从而在一步之内完成任意距离的信息交互。

## 2. 注意力分数的计算

给定输入 $X \\in \\mathbb{R}^{n \\times d}$，用三个可学习矩阵投影出 Query、Key、Value：

$$
Q = XW_Q, \\quad K = XW_K, \\quad V = XW_V
$$

然后计算缩放点积注意力：

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right) V
$$

其中缩放因子 $\\sqrt{d_k}$ 很关键：若不缩放，当 $d_k$ 较大时，$QK^T$ 的方差会随维度线性增长，softmax 会进入饱和区，梯度几乎为 0。

## 3. 一个具体算例

设 $d_k = 4$，某两个位置的 Query 与 Key 为：

$$
q = [1, 0, 1, 0], \\quad k = [1, 0, 1, 0]
$$

则点积为 $q \\cdot k = 2$，缩放后 $2 / \\sqrt{4} = 1$。若还有其他 3 个位置的分数分别是 $0.5, -0.5, 0.2$，则：

$$
\\text{softmax}([1, 0.5, -0.5, 0.2]) \\approx [0.389, 0.242, 0.089, 0.280]
$$

也就是说，该位置会把约 39% 的注意力权重分给目标位置。

## 4. 多头注意力

单个注意力头只能学习一种关联模式。多头注意力把 $d$ 维空间拆成 $h$ 个子空间并行计算：

$$
\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h) W^O
$$

其中 $\\text{head}_i = \\text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$。

不同头可以分别捕捉句法依存、语义相似、指代关系等不同模式。

## 5. 多头自注意力的 PyTorch 实现

\`\`\`python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadSelfAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int):
        super().__init__()
        assert d_model % n_heads == 0
        self.d_k = d_model // n_heads
        self.n_heads = n_heads
        self.qkv = nn.Linear(d_model, 3 * d_model)
        self.out = nn.Linear(d_model, d_model)

    def forward(self, x, mask=None):
        B, L, D = x.shape
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        # (B, L, D) -> (B, heads, L, d_k)
        q = q.view(B, L, self.n_heads, self.d_k).transpose(1, 2)
        k = k.view(B, L, self.n_heads, self.d_k).transpose(1, 2)
        v = v.view(B, L, self.n_heads, self.d_k).transpose(1, 2)

        scores = q @ k.transpose(-2, -1) / (self.d_k ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        attn = F.softmax(scores, dim=-1)
        out = (attn @ v).transpose(1, 2).contiguous().view(B, L, D)
        return self.out(out), attn
\`\`\`

**常见误区**：把 $\\sqrt{d_k}$ 写成 $\\sqrt{d_{model}}$。分母必须与 Query/Key 的实际维度一致，否则缩放失效。

## 6. 复杂度与瓶颈

自注意力的时间与空间复杂度都是 $O(n^2 d)$，序列长度翻倍则计算量翻四倍。这就是长上下文场景下 FlashAttention、线性注意力等工作的出发点。

## 7. 检验问题

1. 若去掉缩放因子 $\\sqrt{d_k}$，训练会出现什么现象？为什么？
2. 为什么说注意力权重之和为 1，但这并不意味着"注意力是均匀分布的"？
3. 在上面的算例中，若把 $d_k$ 改为 16 而点积保持不变，softmax 结果会如何变化？
`

let seeding = false

export async function seedIfEmpty(): Promise<boolean> {
  if (seeding) return false
  seeding = true
  // 清理历史版本可能残留的示例副本，保证只有一份
  const stale = await db.docs.where('collection').equals('示例').toArray()
  for (const d of stale) {
    await db.chunks.where('docId').equals(d.id).delete()
    await db.docs.delete(d.id)
  }
  const count = await db.docs.count()
  if (count > 0) {
    seeding = false
    return false
  }
  const now = Date.now()
  const id = uid('doc_')
  const name = '示例材料 · 注意力机制与 Transformer.pdf'
  const chunks = buildChunks([SAMPLE])
  await db.transaction('rw', [db.docs, db.chunks], async () => {
    await db.docs.add({
      id,
      name,
      kind: 'markdown',
      size: SAMPLE.length,
      pages: 1,
      createdAt: now,
      updatedAt: now,
      text: SAMPLE,
      preview: SAMPLE.slice(0, 600),
      collection: '示例',
    })
    await db.chunks.bulkAdd(
      chunks.map((c) => ({
        id: uid('chk_'),
        docId: id,
        docName: name,
        page: c.page,
        order: c.order,
        text: c.text,
        heading: c.heading,
      })),
    )
  })
  seeding = false
  // 示例知识图谱，让「知识图谱」页一打开就有内容可看
  const kpSeed: [string, string, string][] = [
    ['自注意力', 'concept', '每个位置直接与所有位置计算相关性，一步完成任意距离的信息交互。'],
    ['缩放点积注意力', 'formula', 'softmax(QK^T / sqrt(d_k)) V，除以 sqrt(d_k) 防止 softmax 饱和。'],
    ['多头注意力', 'method', '把 d 维空间拆成 h 个子空间并行计算，学习多种关联模式。'],
    ['梯度消失', 'concept', 'RNN 反向传播时梯度沿时间步连乘，早期位置几乎收不到梯度信号。'],
    ['复杂度瓶颈', 'concept', '自注意力时间与空间复杂度均为 O(n^2 d)，是长上下文场景的主要瓶颈。'],
  ]
  const now2 = Date.now()
  const ids: Record<string, string> = {}
  for (const [i, [name, type, summary]] of kpSeed.entries()) {
    const kid = `kp_seed_${i}`
    ids[name] = kid
    await db.knowledge.add({
      id: kid,
      name,
      type: type as any,
      summary,
      docId: id,
      docName: name,
      mastery: [0.3, 0.5, 0.4, 0.2, 0.15][i],
      mentions: 1,
      createdAt: now2 + i,
      updatedAt: now2 + i,
      tags: ['示例'],
    })
  }
  const edgeSeed: [string, string, string][] = [
    ['自注意力', '缩放点积注意力', 'contains'],
    ['多头注意力', '缩放点积注意力', 'contains'],
    ['梯度消失', '自注意力', 'contrasts'],
    ['自注意力', '复杂度瓶颈', 'related'],
  ]
  for (const [i, [s, t, type]] of edgeSeed.entries()) {
    await db.edges.add({
      id: `edge_seed_${i}`,
      source: ids[s],
      target: ids[t],
      type: type as any,
      weight: 1,
      createdAt: now2 + i,
    })
  }
  seeding = false
  return true
}

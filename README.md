<div align="center">

# 📘 StudyBuddy

**会读你资料的 AI 学习助教 —— 选中哪一段，就只讲哪一段。**

选区即讲 · 举例可视化 · 自动出题 · 知识图谱 · 三层可审计记忆 · 星空成长

[在线体验](https://studybuddy-91919.app.workbuddy.host/?sharecode=PVPZVIH3BM) ·
[参赛指南与运营建议](docs/StudyBuddy-参赛指南与运营建议.md)

</div>

---

## ✨ 它能做什么

上传教材 / 论文 / 笔记，在阅读器里**选中任意一段文字**，AI 助教就会围绕**这一句**展开：

| 能力 | 说明 |
|---|---|
| **沉浸式选区阅读** | pdf.js 渲染真实页面 + 透明文本层，选区即得原文、页码与前后文；浮出工具条可一键「解释这段 / 举个例子 / 可视化 / 出题 / 记入图谱」 |
| **多形态解释** | 一句话结论 → 直观类比 → 逐条拆解 → LaTeX 公式（KaTeX）→ Mermaid 图表 → 代码逐行 → 自检题 |
| **知识图谱** | d3-force 力导向布局，知识点自动沉淀成节点与「前置 / 相关 / 包含」关系，点节点可直接发起追问 |
| **三层可审计记忆** | L1 原始轨迹 / L2 事实摘要 / L3 跨面综合，每条结论可溯源、可手工修正 |
| **题库与错题** | 按资料自动出题 → 自动批改 → 错题自动归档，支持客观题 / 简答 / 代码题 |
| **星空成长** | 水平诊断 → 自动拆分知识模块 → 逐模块消化 → 检验 → 艾宾浩斯间隔复习（1/2/4/7/15/30/60 天） |
| **真实文献检索** | 接 Semantic Scholar + OpenAlex（均免费、支持 CORS、覆盖 arXiv），生成带真实链接的阅读清单 |
| **四套主题** | 经典白 / 深蓝科技 / 青蓝清新 / 皮卡丘黄，即时切换；左右侧栏可拖拽伸缩与独立隐藏 |

## 🔐 模型调用记在谁头上

StudyBuddy 内置 **两条模型通道 + 一个演示模式**：

| 通道 | 接入方式 | 费用由谁承担 |
|---|---|---|
| **① WorkBuddy 账号通道** | 点「使用 WorkBuddy 登录」（微信 / 手机号 / 邮箱 / SSO） | **使用者自己的 WorkBuddy 积分**，作者零成本 |
| **② 我自己的 API Key** | 填 Base URL / Key / 模型名，兼容一切 OpenAI 协议服务 | **用户自己**（与你的模型服务商结算） |
| **③ 演示模式**（默认） | 内置离线样例响应，不调用任何模型 | **0** |

> **未登录时 WorkBuddy 通道默认禁用。** 原因是：SDK 只在用户登录后才携带 `Authorization: Bearer` 令牌，
> 未登录的请求没有身份，计费会落到**应用创建者**头上。界面在首页顶栏、右侧「账户与计费」卡片、
> 侧栏底部与设置页四处明示当前归属状态。

## 🧰 技术栈

React 19 · TypeScript · Vite · Tailwind CSS · Dexie（IndexedDB）· pdfjs-dist · mammoth · KaTeX · Mermaid · d3-force · WorkBuddy Cloud SDK

## 🚀 快速开始

```bash
# 1. 安装依赖（Node.js ≥ 20）
npm install

# 2. 本地开发
npm run dev          # http://127.0.0.1:5273

# 3. 类型检查 + 生产构建
npm run build

# 4. 本地预览构建产物
npm run preview
```

**首次打开会自动植入一份示例材料**（注意力机制与 Transformer），无需先上传文件即可体验完整链路。

### 接入自己的模型

```bash
cp .env.example .env
# 编辑 .env，按需填写 VITE_WB_* 或 VITE_OWN_*
```

也可以在应用内「设置 → 大模型通道 → 我自己的 API Key」直接填写（仅存于本机浏览器）。

## 📁 目录结构

```
studybuddy/
├── src/
│   ├── components/          # 通用组件
│   │   ├── AccountChip.tsx  # WorkBuddy 登录入口 + 计费归属提示
│   │   ├── Logo.tsx         # 橙蓝品牌标识
│   │   ├── Markdown.tsx     # Markdown + KaTeX + Mermaid + 代码高亮
│   │   ├── chat/            # 对话区（消息气泡、流式渲染、选区 chip）
│   │   ├── layout/          # AppShell、左右侧栏、主题切换器
│   │   └── reading/         # PDF 渲染器、文档阅读器、选区工具条
│   ├── lib/                 # 核心能力层
│   │   ├── account.ts       # WorkBuddy 账号：登录 / 回调 / 登出 / 归属判定
│   │   ├── actions.ts       # 业务编排：问答、出题、批改、诊断、复习排期
│   │   ├── db.ts            # Dexie 数据库（18 张表）与导入导出
│   │   ├── llm.ts           # 多通道 LLM 网关（流式 / 超时 / 错误分类）
│   │   ├── parse.ts         # PDF / DOCX / Markdown / 图片 解析
│   │   ├── prompts.ts       # 提示词中心（六种模式 + 结构化抽取）
│   │   ├── retrieval.ts     # 本地 BM25 检索（无需 embedding）
│   │   ├── seed.ts          # 首次运行的示例资料与示例图谱
│   │   └── srs.ts           # 艾宾浩斯间隔重复调度
│   ├── store/app.ts         # 全局状态（zustand + 持久化）
│   ├── views/               # 9 个页面：主页/对话/阅读/资料库/图谱/记忆/题库/成长/调研/设置
│   ├── config/site.ts       # 站点配置（环境变量 > 内置默认）
│   ├── types.ts             # 全局类型
│   └── index.css            # 三/四套主题的 CSS 变量与全局样式
├── public/                  # favicon、公开资源
├── tools/make_pika_bg.py    # 皮卡丘主题背景图生成脚本（Pillow）
├── docs/                    # 参赛指南与运营建议
├── server.js                # 生产静态服务器（SPA 回退）
├── index.html
├── vite.config.ts
└── tailwind.config.js
```

## 🔒 数据与隐私

- **所有学习数据都留在本机浏览器**（IndexedDB）：资料、笔记、知识点、图谱、题库、记忆。
- 不上传任何第三方服务器；可在「设置 → 数据管理」一键导出 / 导入备份 / 清空。
- 用户填写的 API Key 仅存于本地 `localStorage`，随浏览器扩展配置写入 `src/lib/llm.ts`。

## 🚢 部署

```bash
npm run build
npm start            # = npm run build && node server.js
```

`server.js` 以 ESM 托管 `dist/` 并提供 SPA 回退，监听 `PORT` 环境变量、绑定 `0.0.0.0`。
本作品当前通过 WorkBuddy 站点发布能力上线，运行于 `https://studybuddy-91919.app.workbuddy.host`。

## 🙏 致谢

- **[DeepTutor](https://github.com/HKUDS/DeepTutor)**（香港大学 HKUDS 实验室，Apache-2.0）
  —— 本项目的三层可审计记忆、双循环推理、题库 / 错题 / 掌握路径、沉浸式阅读等设计均受其启发。
- **[WorkBuddy Cloud SDK](https://www.npmjs.com/package/@tencent-ai/workbuddy-cloud-sdk)** —— 免密钥模型调用与账号体系。


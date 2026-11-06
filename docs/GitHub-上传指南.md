# StudyBuddy · 上传到 GitHub 完整操作指引

> 目标：把本地 `studybuddy/` 目录整理成一个结构清晰、可复现、可协作的 GitHub 仓库。
> 全文命令均为**可直接复制执行**的，每步都标注了**预期结果**。

---

## 0. 当前状态（已替你做完的部分）

| 项目 | 状态 |
|---|---|
| 死代码清理 | ✅ 删除 `src/assets/hero.png`、`src/assets/vite.svg`、`public/icons.svg`、`public/pika-bg.png`（重复文件） |
| 工具与文档归档 | ✅ `tools/make_pika_bg.py` 与参赛指南迁入仓库内 `tools/` `docs/` |
| `.gitignore` | ✅ 已重写：依赖 / 构建产物 / `.env*` / 缓存 / 编辑器 / `*.genie` / 学习数据备份 |
| `.gitattributes` | ✅ 已添加：统一 LF 行尾 + 二进制资源标记（消除 Windows CRLF 噪音） |
| `.env.example` | ✅ 已添加：环境变量模板（`.env` 本身被忽略） |
| `README.md` | ✅ 已重写为完整项目说明（模板 boilerplate 已清除） |
| 本地 Git 仓库 | ✅ 已 `git init -b main`，文件已 `git add` 暂存（**尚未 commit**） |
| 忽略规则验证 | ✅ 实测通过：暂存区 56 个文件，无 `node_modules` / `dist` / 真实 `.env` / 密钥 |

**还需你完成**：创建远程仓库 → 关联 → 提交 → 推送。

---

## 1. 项目定位信息

**源码根目录**（Git 仓库根就在这里，不要跑到上一层去）：

```
D:/WorkBuddy工作/2026-10-28-14-21-38/studybuddy/
```

> ⚠️ **关键提醒**：工作区的上一层 `D:/WorkBuddy工作/2026-10-28-14-21-38/` 里有两个**绝对不能**进仓库的东西：
> - `_reference/DeepTutor/` —— 港大 DeepTutor 的完整克隆（自带 `.git`，3000+ 文件）
> - `.workbuddy/`、`*.genie` —— 平台本地文件
>
> 因为仓库根设在 `studybuddy/`，这些天然被排除在外。**千万不要 `cd` 到上一层执行 git 命令。**

**主要模块地图**（40 个源文件 / `src/`）：

| 目录 | 职责 | 关键文件 |
|---|---|---|
| `src/lib/` | 核心能力层 | `llm.ts` 多通道模型网关、`db.ts` Dexie 18 张表、`parse.ts` PDF/DOCX 解析、`retrieval.ts` 本地 BM25、`prompts.ts` 提示词中心、`account.ts` WorkBuddy 账号、`srs.ts` 艾宾浩斯、`seed.ts` 示例数据、`actions.ts` 业务编排、`academic.ts` 学术检索 |
| `src/components/` | 通用组件 | `AccountChip` 登录入口、`Markdown`（KaTeX+Mermaid）、`chat/` 对话区、`layout/` 侧栏与主题、`reading/` PDF 渲染与选区工具条 |
| `src/views/` | 9 个页面 | 主页 / 对话 / 阅读 / 资料库 / 图谱 / 记忆 / 题库 / 星空成长 / 调研 / 设置 |
| `src/store/` | 全局状态 | `app.ts` zustand + 持久化 |
| `src/config/` | 站点配置 | `site.ts` 环境变量优先级 |
| `tools/` `docs/` | 辅助 | 图片生成脚本、参赛指南 |

---

## 2. 第一步：上传前准备（已完成，执行下面的命令做最终确认）

### 2.1 确认忽略规则生效

```bash
cd "D:/WorkBuddy工作/2026-10-28-14-21-38/studybuddy"

git status --short
```

**预期结果**：输出一批 `A  ` 开头的行（新增文件），**没有任何** `node_modules/` 或 `dist/` 路径。

```bash
# 三条硬校验，任意一条输出内容都说明还有脏文件
git diff --cached --name-only | grep -E "^node_modules/|^dist/|(^|/)\.env$|\.key$|\.pem$" && echo "!!! 有问题" || echo "✅ 干净"

git check-ignore -v .env            # 预期：.gitignore:24:.env	.env
git check-ignore -v node_modules    # 预期：.gitignore:19:node_modules/	node_modules
```

### 2.2 确认没有泄露真实密钥

```bash
grep -rn "sk-[a-zA-Z0-9]\{20,\}" src/ public/ 2>/dev/null && echo "!!! 发现疑似真实 API Key" || echo "✅ 未发现真实模型 Key"
```

**预期结果**：`✅ 未发现真实模型 Key`。

> **关于 `publishableKey`（`src/config/site.ts` 与 `public/wb-public-config.json`）**
> 它是 **公开的应用标识，不含任何权限**（官方明确允许随前端代码分发，真实模型凭证始终在服务端），
> 所以**可以安全提交**。但如果你要部署自己的实例，记得用 `.env` 里的
> `VITE_WB_ENDPOINT` / `VITE_WB_PUBLISHABLE_KEY` 覆盖成你自己的值。

### 2.3 构建自检（确保推上去的代码是能跑的）

```bash
npm run build
```

**预期结果**：末尾出现 `✓ built in Xs`，无 TS 报错。

### 2.4 补一个 LICENSE（可选但强烈建议）

仓库若要公开，**必须**有许可证，否则别人无权使用你的代码。

```bash
# 下载 Apache-2.0（与 DeepTutor 同协议）
curl -L https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE
# 或 MIT：
# curl -L https://opensource.org/license/mit -o LICENSE   # 需手动裁剪正文
```

**预期结果**：项目根出现 `LICENSE` 文件（约 11KB）。

---

## 3. 第二步：分批提交（目录顺序 + commit message 规范）

### 3.1 建议的提交顺序

先把已暂存的内容全部退回工作区，再按下面 5 批重新暂存：

```bash
git reset            # 取消暂存，文件保留在工作区（不会删文件）
```

| 批次 | 范围 | 目录/文件 | commit message |
|---|---|---|---|
| ① 工程脚手架 | 构建配置 | `package.json` `package-lock.json` `tsconfig*.json` `vite.config.ts` `tailwind.config.js` `postcss.config.js` `.oxlintrc.json` `index.html` `server.js` | `chore: 初始化 Vite + React 19 + TypeScript 工程脚手架` |
| ② 仓库规范 | 文档与规范 | `.gitignore` `.gitattributes` `.env.example` `README.md` `docs/` `tools/` `LICENSE` | `docs: 补充项目说明、参赛指南与仓库规范` |
| ③ 核心能力层 | 业务内核 | `src/types.ts` `src/config/` `src/lib/` | `feat(core): 实现多通道模型网关、本地检索与三层记忆内核` |
| ④ 界面与主题 | UI 框架 | `src/App.tsx` `src/main.tsx` `src/index.css` `src/components/` `src/store/` `src/assets/` `public/` | `feat(ui): 实现四套主题、双侧栏布局与选区阅读器` |
| ⑤ 功能视图 | 页面 | `src/views/` | `feat(views): 实现资料库、知识图谱、题库与星空成长等页面` |

### 3.2 逐批提交命令（可直接整段复制）

```bash
cd "D:/WorkBuddy工作/2026-10-28-14-21-38/studybuddy"
git reset

# ① 工程脚手架
git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json \
        vite.config.ts tailwind.config.js postcss.config.js .oxlintrc.json index.html server.js
git commit -m "chore: 初始化 Vite + React 19 + TypeScript 工程脚手架"

# ② 仓库规范与文档
git add .gitignore .gitattributes .env.example README.md docs tools LICENSE
git commit -m "docs: 补充项目说明、参赛指南与仓库规范"

# ③ 核心能力层
git add src/types.ts src/config src/lib
git commit -m "feat(core): 实现多通道模型网关、本地检索与三层记忆内核"

# ④ 界面与主题
git add src/App.tsx src/main.tsx src/index.css src/components src/store src/assets public
git commit -m "feat(ui): 实现四套主题、双侧栏布局与选区阅读器"

# ⑤ 功能视图
git add src/views
git commit -m "feat(views): 实现资料库、知识图谱、题库与星空成长等页面"
```

**预期结果**：每条命令输出一段 `[main xxxxxxx] <message>` + `N files changed`。
第 ② 批若没建 `LICENSE`，把它从命令里去掉即可。

### 3.3 校验提交历史

```bash
git log --oneline --graph --stat | head -40
```

**预期结果**：5 条提交，顺序与上表一致，每条都带对应的文件列表。

> 💡 如果 `LICENSE` 不存在，`git add ... LICENSE` 会报 `pathspec 'LICENSE' did not match any files` —— 忽略该错误，其余照常。

### 3.4 commit message 规范

采用 **Conventional Commits**，格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

| type | 用于 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 Bug |
| `docs` | 只改文档 |
| `style` | 只改格式（不改逻辑） |
| `refactor` | 重构，不改外部行为 |
| `perf` | 性能优化 |
| `test` | 补测试 |
| `chore` | 构建/依赖/杂项 |
| `build` | 影响构建系统 |
| `ci` | CI 配置 |

规则：
- **subject 用中文祈使句，不超过 50 字**，句末不加句号
- **scope 用模块名**：`core` `ui` `views` `reading` `llm` `deps`
- body 写「为什么改」而非「改了什么」，每行 ≤ 72 字
- 破坏性变更加 `BREAKING CHANGE:` 尾巴
- 关联 issue 写 `Closes #123`

示例：

```
feat(reading): 支持 PDF 选区直接触发逐句讲解

原先用户只能整篇提问，选区交互缺失。
现改为渲染真实页面 + 透明文本层，选中后浮出工具条，
并把原文、页码与前后文一并注入上下文。
```

---

## 4. 第三步：创建远程仓库并关联

### 4.1 在 GitHub 上建仓库（网页方式）

1. 打开 <https://github.com/new>
2. **Repository name**：`StudyBuddy`（或 `studybuddy`）
3. **Public**（若要参赛展示选 Public）
4. ⚠️ **不要勾选** "Add a README file" / .gitignore / License —— 本地已有，手动勾会引发冲突
5. 点 **Create repository**

**预期结果**：跳转到空仓库页，右下角提示 `quick setup`。

### 4.2 关联本地仓库

```bash
cd "D:/WorkBuddy工作/2026-10-28-14-21-38/studybuddy"
git remote -v          # 预期：输出为空（还没关联）
git remote add origin https://github.com/<你的用户名>/StudyBuddy.git
git remote -v          # 预期：出现 origin 两行（fetch/push）
```

把 `<你的用户名>` 换成你的 GitHub 用户名。若仓库名用了小写 `studybuddy`，这里也用小写。

### 4.3 确认本地身份（已配置过则跳过）

```bash
git config --global user.name
git config --global user.email
```

**预期结果**：`zhiheng098` 与 `3291835395@qq.com`（本机已配置）。
若为空再执行：

```bash
git config --global user.name "你的昵称"
git config --global user.email "你的邮箱@example.com"
```

---

## 5. 第四步：推送 + 认证方式选择

### 5.1 先推一次看看认证走哪条路

```bash
git push -u origin main
```

**本机环境已配置 Git Credential Manager**（`credential.helper=manager`），
所以预期会**自动弹出浏览器窗口**要求登录 GitHub 并授权 → 登录完成后推送自动继续。

**预期结果**：

```
Enumerating objects: 56, done.
...
To https://github.com/<你的用户名>/StudyBuddy.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

### 5.2 三种认证方式对比与切换

| 方式 | 命令 | 适用 | 备注 |
|---|---|---|---|
| **A. HTTPS + 凭据管理器**（推荐，本机已就绪） | `git push -u origin main` | 一次性、最省事 | 首次弹浏览器授权，之后凭据存 Windows 凭据库 |
| **B. HTTPS + Personal Access Token** | 见下 | CI / 无浏览器环境 | 需手动创建并粘贴 PAT |
| **C. SSH 密钥** | 见 5.4 | 长期高频推送 | 一次性配置，之后免密 |

#### 方式 B：Personal Access Token

1. GitHub → 头像 → Settings → Developer settings → Personal access tokens → **Tokens (classic)**
2. Generate new token (classic)，勾选 `repo` + `workflow`，有效期按需
3. 复制那串 `ghp_...`（**只显示一次**）
4. 推送时粘贴：

```bash
git push -u origin main
# Username: <你的GitHub用户名>
# Password: <粘贴 ghp_...>     ← 粘贴密码处填 token，不是账号密码
```

**预期结果**：同 5.1 的 `* [new branch] main -> main`。

#### 方式 C：SSH

```bash
# 1) 生成密钥对（ed25519）
ssh-keygen -t ed25519 -C "3291835395@qq.com" -f ~/.ssh/id_ed25519_github
#    一路回车（passphrase 可留空）

# 2) 复制公钥
cat ~/.ssh/id_ed25519_github.pub
```

把输出整行添加到 GitHub → Settings → SSH and GPG keys → New SSH key。

```bash
# 3) 写入 ssh config
cat >> ~/.ssh/config <<'EOF'

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
EOF

# 4) 测试
ssh -T git@github.com
```

**预期结果**：`Hi <你的用户名>! You've successfully authenticated...`

```bash
# 5) 切换 remote 并推送
git remote set-url origin git@github.com:<你的用户名>/StudyBuddy.git
git push -u origin main
```

**预期结果**：同 5.1。

### 5.3 推送后验证

```bash
git remote -v
git status
git ls-remote --heads origin
```

**预期结果**：
- `git status` 显示 `working tree clean`，且 `Your branch is up to date with 'origin/main'`
- `git ls-remote` 输出一行含 `refs/heads/main` 和一串 SHA

### 5.4 建议的补充：打一个版本标签

```bash
git tag -a v1.0.0 -m "StudyBuddy v1.0.0：选区阅读 + 知识图谱 + 星空成长 + 四套主题"
git push origin v1.0.0
```

**预期结果**：`git ls-remote --tags origin` 能看到 `refs/tags/v1.0.0`。

---

## 6. 常见报错处理（按顺序排查，每步给出命令与预期结果）

### 报错 ① `fatal: not a git repository`

**原因**：在错误的目录执行了 git 命令（很可能跑到了工作区上层）。

```bash
cd "D:/WorkBuddy工作/2026-10-28-14-21-38/studybuddy"
git status
```

**预期结果**：输出 `On branch main` + `nothing to commit, working tree clean`。

---

### 报错 ② `remote origin already exists`

**原因**：重复执行了 `git remote add`。

```bash
git remote -v                              # 先看当前指向
git remote set-url origin https://github.com/<你的用户名>/StudyBuddy.git
git remote -v                              # 预期：URL 已更新
```

---

### 报错 ③ `Permission denied (publickey)` / `Permission denied (repository)`

**原因 A：SSH 公钥没加到 GitHub**

```bash
ssh -T git@github.com
cat ~/.ssh/id_ed25519_github.pub
```

把输出加到 GitHub → Settings → SSH and GPG keys，再重试 `ssh -T git@github.com`。

**原因 B：HTTPS 没登录或凭据过期**

```bash
git config --global credential.helper manager
# 强制清掉旧凭据，下次推送会重新弹窗
cmdkey /delete:git:https://github.com 2>/dev/null || true
git push -u origin main
```

**预期结果**：弹出浏览器授权窗口 → 授权 → 推送成功。

**原因 C（最常见）：没有推送到自己的仓库 / 没有写权限**

```bash
# 核对远程地址与用户名是否正确
git remote get-url origin
# 修正
git remote set-url origin https://github.com/<你的用户名>/StudyBuddy.git
```

---

### 报错 ④ `Updates were rejected because the remote contains work that you do not have locally`

**原因**：远程仓库已有提交（最常见是建仓时勾了 README，或别人先推过）。

**先看差异**：

```bash
git fetch origin
git log --oneline --graph --all | head -20
```

**方案 1（推荐，保留远程 README）**：拉取并合并

```bash
git pull origin main --allow-unrelated-histories
```

**预期结果**：出现 `Merge made by the 'ort' strategy.`。
若提示冲突，只可能冲突在 `README.md`，手动解决后：

```bash
git add README.md
git commit -m "chore: 合并远程仓库初始提交"
git push -u origin main
```

**方案 2（本地为主，覆盖远程）**：仅在确认远程内容不重要时用

```bash
git push -u origin main --force
```

> ⚠️ `--force` 会丢弃远程提交。除非你确定远程只有一个自动生成的 README，否则别用。

---

### 报错 ⑤ `remote: error: File size limit exceeded` / `large files detected`

**原因**：单个文件超过 GitHub 100MB 硬上限。

**本项目当前不会触发**（最大文件是 `package-lock.json` 231KB、`pika-bg.png` 60KB）。仍需自查：

```bash
git ls-files | while read f; do s=$(wc -c < "$f"); if [ "$s" -gt 50000000 ]; then echo "$((s/1024/1024))MB  $f"; fi; done
```

**预期结果**：无输出。

若确实有大文件：

```bash
# 方案 A：用 Git LFS（本机已装）
git lfs install
git lfs track "*.psd" "*.zip"
git add .gitattributes && git commit -m "chore: 配置 Git LFS"
# 提交前再把大文件移出历史：
#   git filter-repo --path bigfile.zip --invert-paths

# 方案 B：直接从历史里剔除（需 pip install git-filter-repo）
git filter-repo --path bigfile.zip --invert-paths
git push -u origin main --force
```

---

### 报错 ⑥ `error: failed to push some refs` + `Updates were rejected`

同报错 ④，执行 `git pull origin main --allow-unrelated-histories` 后再推。

---

### 报错 ⑦ `warning: LF will be replaced by CRLF`

**原因**：Windows 换行符与仓库 LF 不一致。

**已解决**：本仓库已添加 `.gitattributes`（`* text=auto eol=lf`），此警告在本次提交后不会再出现。
若仍看到，说明 `.gitattributes` 没生效，检查：

```bash
git check-attr text eol -- src/main.tsx
```

**预期结果**：`src/main.tsx: text: auto` 与 `eol: lf`。

---

### 报错 ⑧ `nothing to commit, working tree clean` 但你以为改了文件

```bash
git status --short              # 看有无未跟踪/已修改
git diff                        # 看具体改动
git add -A && git status --short # 重新暂存
```

若文件确实没出现在 `git status` 里，检查它是否被 `.gitignore` 命中：

```bash
git check-ignore -v <文件路径>
```

---

### 报错 ⑨ `The requested URL returned error: 403` / `HTTPS-FAILED` / 网络超时

**原因**：网络代理或防火墙拦截。

```bash
# 测试连通性
curl -I https://github.com
```

若需走代理：

```bash
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
# 用完取消
# git config --global --unset http.proxy
```

或改用 SSH 方式（走 22 端口，通常不受 HTTPS 代理影响）。

---

### 报错 ⑩ `git push` 后 GitHub 仓库是空的 / 页面还是旧的

```bash
git ls-remote --heads origin
git log origin/main --oneline -3
```

若输出为空 → 推送没真正发生，回到 5.1 重推。
若本地有远程没有的提交：

```bash
git push -u origin main --force-with-lease
```

`--force-with-lease` 比 `--force` 安全：只有远程确实是你预期的那份提交时才覆盖。

---

## 7. 上传后自检清单

```bash
# 1) 本地与远程一致
git status -sb                                   # 预期：## main...origin/main（无 ahead/behind）
git diff origin/main --stat                      # 预期：无输出

# 2) 仓库体积合理
git count-objects -vH | grep size-pack

# 3) 关键文件都在
git ls-tree -r --name-only HEAD | grep -E "README|.gitignore|.env.example|src/lib/llm.ts|tools/"
```

**预期结果**：全部命中。

浏览器打开 `https://github.com/<你的用户名>/StudyBuddy`，应看到：
- 55+ 个文件的目录树（**没有** `node_modules`、**没有** `dist`）
- 顶部渲染正常的 README（标题、表格、徽章）
- 右侧 About 栏可设置 Description / Topics（建议加 `ai-education`、`react`、`typescript`、`pdf-reader`、`knowledge-graph`）
- 仓库设置里开 **Discussions** 与 **Issues**，方便评委反馈

---

## 8. 最后三个提醒

1. **`_reference/DeepTutor/` 不要提交** —— 那是港大项目的完整克隆，有独立 LICENSE 与 `.git`。如果想在 README 里致谢它，链接仓库地址即可，别把代码搬进来。
2. **`publishableKey` 可以提交**（公开标识、无权限），但部署自己的实例时请用 `.env` 覆盖。
3. **补 LICENSE** —— 公开仓库没有许可证，等于默认保留所有权利，别人不敢用你的代码。

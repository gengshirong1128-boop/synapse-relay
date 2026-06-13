# Candidate Cards

Candidate cards are not official cards yet. They must be tested against examples before moving into `cards/`.

Each candidate needs trigger conditions, a decision rule, and output impact before promotion.

## 目标函数先定义

- Source Domain: 运筹学
- Trigger Condition: 用户同时追求速度、质量、成本、稳定性
- Decision Rule: 先明确本轮最重要的目标函数，再比较路线
- Output Impact: RoutePlan 的 Options 必须按同一目标比较
- Candidate For: decision-cards.md

## 硬约束不可违反

- Source Domain: 运筹学 / 风险控制
- Trigger Condition: 用户明确说不要改 UI、不要新增依赖、不要执行命令
- Decision Rule: 任何违反硬约束的路线直接淘汰
- Output Impact: scoring-rules.md 加入硬门槛
- Candidate For: decision-cards.md

## 阻塞任务优先

- Source Domain: 项目管理
- Trigger Condition: 某问题阻止后续测试、开发、发布或判断
- Decision Rule: 先解决阻塞项，再做优化项
- Output Impact: Priority 标记为 P0
- Candidate For: priority-cards.md

## 最短闭环优先

- Source Domain: 运筹学
- Trigger Condition: 多条路线都可行，但验证周期不同
- Decision Rule: 优先选择最快得到可验证结果的路线
- Output Impact: RoutePlan First Action 更短
- Candidate For: priority-cards.md

## 事实和假设分离

- Source Domain: 逻辑学
- Trigger Condition: 用户提供部分上下文、猜测或不完整 Snapshot
- Decision Rule: 输出中必须分离 confirmed facts 和 assumptions
- Output Impact: RoutePlan Risks 和 HandoffBrief 更清楚
- Candidate For: decision-cards.md

## 概念不清先定义

- Source Domain: 逻辑学
- Trigger Condition: 用户使用“优化”“重构”“清理”等宽泛词
- Decision Rule: 先定义术语含义，再进入路线比较
- Output Impact: Choice Questions 必须先问定义问题
- Candidate For: decision-cards.md

## 推荐必须有理由链

- Source Domain: 逻辑学
- Trigger Condition: Skill 给出推荐路线
- Decision Rule: 推荐必须包含目标、约束、风险、评分的理由链
- Output Impact: Recommended Route 必须有 reason chain
- Candidate For: decision-cards.md

## 反例削弱推荐

- Source Domain: 逻辑学
- Trigger Condition: 某路线看似最好，但存在明显反例或失败场景
- Decision Rule: 必须说明什么情况下该路线不适用
- Output Impact: Options 增加 Not For
- Candidate For: risk-cards.md

## 防止锚定第一方案

- Source Domain: 决策心理学
- Trigger Condition: 用户或模型一开始就倾向某路线
- Decision Rule: 至少生成两个替代路线再推荐
- Output Impact: RoutePlan 必须保留 3 个 Options
- Candidate For: decision-cards.md

## 防止工具光环

- Source Domain: 决策心理学
- Trigger Condition: 用户指定某 Agent 或工具，但任务未必适合
- Decision Rule: 先判断任务类型，再分配 Agent
- Output Impact: Recommended Agent 必须写理由
- Candidate For: risk-cards.md

## 沉没成本不作为继续理由

- Source Domain: 决策心理学
- Trigger Condition: 用户因已投入很多时间而想继续原路线
- Decision Rule: 已投入成本不能单独作为继续理由
- Output Impact: Options 重新按目标和风险评分
- Candidate For: decision-cards.md

## 高风险先列未知项

- Source Domain: 风险控制
- Trigger Condition: 路线影响数据、发布、权限、配置或大范围架构
- Decision Rule: 先列 unknowns，再决定是否执行
- Output Impact: First Action 变成分析或人工确认
- Candidate For: risk-cards.md

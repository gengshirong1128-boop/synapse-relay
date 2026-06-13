# Risk Cards

Risk Cards 用来识别路线中的常见风险。高风险任务至少选择 1 张。

## 需求不清

- 表现：目标模糊、验收标准缺失、用户只说“优化一下”
- 风险：Agent 自行扩展需求
- 处理：先生成 RoutePlan 和问题清单
- 输出影响：降低 confidence，推荐 Human 或 Claude Code

## 改动过大

- 表现：任务从一个 bug 扩展到重构多个模块
- 风险：引入回归，难以审查
- 处理：拆成 P0/P1/P2，先做最小闭环
- 输出影响：限制 scope

## UI 被误改

- 表现：原任务不是视觉改版，但可能碰到组件或样式
- 风险：界面布局、交互、文案被顺手改乱
- 处理：把无关 UI 写入 forbiddenChanges
- 输出影响：启用 UI 变更隔离

## Provider 逻辑被误改

- 表现：任务涉及模型、配置、密钥、Provider 切换
- 风险：认证失败、密钥暴露、环境不可用
- 处理：执行和配置分层；不改 Provider 逻辑，除非明确要求
- 输出影响：加入人工确认节点

## 新增依赖

- 表现：Agent 倾向引入库解决小问题
- 风险：包体增加、版本冲突、维护成本上升
- 处理：默认禁止新增依赖
- 输出影响：constraints 加入“不新增依赖”

## 缺少测试

- 表现：输出只说明改了代码，没有验证
- 风险：无法确认目标完成
- 处理：验收标准必须包含测试或手动验证
- 输出影响：Review 可能判定 needs-fix

## 上下文过大

- 表现：用户粘贴大量文件、日志或历史对话
- 风险：重点丢失，Agent 抓错上下文
- 处理：先压缩成 Snapshot / HandoffBrief
- 输出影响：推荐先做 handoff-brief

## 把 Snapshot 当完整项目

- 表现：用户提供了部分文件树或摘要
- 风险：AI 声称知道完整项目结构
- 处理：所有结论标记为“基于用户提供的上下文”
- 输出影响：assumptions 必填

## 自动执行命令风险

- 表现：任务涉及 shell、git、部署、删除、迁移
- 风险：破坏本地状态或远端状态
- 处理：只生成可复制命令，要求用户确认
- 输出影响：forbiddenChanges 加入“不自动执行”

## 读取密钥风险

- 表现：任务涉及 `.env`、API Key、token、认证头
- 风险：密钥泄露
- 处理：禁止读取或展示真实密钥，只使用占位符
- 输出影响：安全检查必选

## 理论堆砌风险

- 表现：输出大量逻辑学、博弈论、运筹学术语，但没有触发条件、下一步或验收标准
- 风险：看起来高级，实际不可执行
- 处理：每个理论点必须落成 Decision Card、Risk Card、Priority Card 或评分规则
- 输出影响：ReviewReport 若发现理论无法执行，判定 needs-fix

## 代理人错配风险

- 表现：任务被交给最强、最便宜或最熟悉的 Agent，而不是最适合的执行者
- 风险：分析型 Agent 误执行、执行型 Agent 乱规划、低成本 Agent 漏掉高风险
- 处理：使用“防止工具光环”和“激励一致才委派”
- 输出影响：Selected Agent 必须写适配理由、边界和回报要求

## 策略反应风险

- 表现：路线会改变其他成员、用户、市场、团队或 Agent 的行为
- 风险：单方最优在多方互动中失效
- 处理：列出关键参与方、可能反应和最小后悔动作
- 输出影响：RoutePlan Risks 增加 stakeholder reaction / strategic risk

## 从众风险

- 表现：后发成员重复领先意见，没有独立证据或反例
- 风险：看似形成共识，实际只是锚定与迎合
- 处理：先独立表态，再交叉质询；必须保留 Strongest Dissent
- 输出影响：DecisionReceipt 缺少独立意见时判定 needs-fix

## 否决滥用风险

- 表现：Risk Minister 用偏好、保守倾向或模糊担忧否决路线
- 风险：所有创新路线被无限阻塞，Veto 退化为普通反对票
- 处理：Veto 必须基于硬约束、安全边界或不可接受不可逆损失，并给出 Unblock Condition
- 输出影响：无 Basis 或 Unblock Condition 的 Veto 无效

## 翻案条件缺失

- 表现：决议只给推荐，不说明什么证据会推翻它
- 风险：团队对原建议产生承诺升级，错过停止或转向时机
- 处理：为关键假设定义 Observable Signal、Threshold 和 Action When Triggered
- 输出影响：DecisionReceipt 缺少 Flip Conditions 时不得判定为完整

## 结果偏见风险

- 表现：仅凭最终结果好坏评价原决策
- 风险：奖励碰运气，惩罚合理但受外部冲击影响的决策
- 处理：OutcomeReview 分开评价 Decision Quality 和 Execution Quality
- 输出影响：复盘必须记录 Prediction Error、Execution Error 和 External Shock

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useWorkshopStore, type MergeOutcome } from '../stores/workshop'

const store = useWorkshopStore()

const statusMeta = computed(() => {
  switch (store.handoverStatus) {
    case 'offline':
      return { label: '离线草稿中', type: 'warning' as const, desc: '改动保存在本地，回网后按提示编号合并。' }
    case 'merging':
      return { label: '正在交接', type: 'primary' as const, desc: '正在与主控版本比对并合并…' }
    case 'failed':
      return { label: '交接失败', type: 'danger' as const, desc: '已从最后确认状态恢复，可重试。' }
    case 'done':
      return { label: '交接完成', type: 'success' as const, desc: '离线改动已并入主控。' }
    default:
      return { label: '在线待命', type: 'success' as const, desc: '主控版本已同步，可随时开始离线作业。' }
  }
})

const pendingChanges = computed(() => store.offlineChanges.filter((c) => !c.applied))
const appliedChanges = computed(() => store.offlineChanges.filter((c) => c.applied))

const conflictForks = computed(() =>
  store.cues.filter((cue) => cue.conflictOf && cue.conflictState === '待处置'),
)

function masterOf(cueId: string) {
  return store.cues.find((c) => c.id === cueId)
}

function outcomeType(result: MergeOutcome['result']) {
  switch (result) {
    case 'merged':
      return 'success'
    case 'conflict':
      return 'danger'
    case 'created':
      return 'primary'
    default:
      return 'info'
  }
}

async function nudgeMaster() {
  const result = await store.simulateMasterChange()
  if (result) {
    ElMessage.warning(`主控端改动了 ${result.cueId} 的时间码：${result.previousTime} → ${result.time}`)
  }
}

function resolve(cueId: string, resolution: 'master' | 'offline' | 'keep-both') {
  store.resolveConflict(cueId, resolution)
  ElMessage.success('冲突已处置，相关提示重新进入确认与打印范围')
}
</script>

<template>
  <section class="page handover-page">
    <div class="page-head">
      <div>
        <p class="eyebrow">HANDOVER / 场次交接</p>
        <h1>离线回网 · 合并与冲突处置</h1>
        <p class="muted">离线改动按提示编号与主控合并；两边都改过则留两份待处置，未处置的不进基线或打印清单。</p>
      </div>
      <div class="actions">
        <el-button @click="store.toggleOffline">
          {{ store.isOffline ? '回网交接' : '进入离线作业' }}
        </el-button>
        <el-button type="primary" :disabled="!store.isOffline && store.handoverStatus !== 'failed'" @click="store.retryHandover">
          重试交接
        </el-button>
      </div>
    </div>

    <div class="status-banner panel" :class="store.handoverStatus">
      <div class="status-main">
        <el-tag :type="statusMeta.type" effect="dark">{{ statusMeta.label }}</el-tag>
        <div>
          <strong>{{ statusMeta.desc }}</strong>
          <small>
            版本 {{ store.revision }}
            <template v-if="store.lastConfirmedAt"> · 最后确认 {{ new Date(store.lastConfirmedAt).toLocaleString('zh-CN') }}</template>
          </small>
        </div>
      </div>
      <div class="status-stats">
        <div class="stat"><span>待合并改动</span><strong>{{ pendingChanges.length }}</strong></div>
        <div class="stat"><span>待处置冲突</span><strong class="red">{{ store.pendingConflictCount }}</strong></div>
        <div class="stat"><span>历史场次</span><strong>{{ store.historicalCount }}</strong></div>
      </div>
    </div>

    <div class="handover-grid">
      <section class="panel">
        <div class="panel-head">
          <h3>离线改动</h3>
          <span class="muted">{{ store.isOffline ? '离线作业中' : '回网后自动合并' }}</span>
        </div>

        <div v-if="pendingChanges.length" class="change-list">
          <div v-for="change in pendingChanges" :key="change.changeId" class="change-row">
            <el-tag size="small" effect="plain">{{ change.kind }}</el-tag>
            <strong>{{ change.cueId }}</strong>
            <span>{{ change.patch?.title }}</span>
            <time>{{ new Date(change.at).toLocaleTimeString('zh-CN') }}</time>
          </div>
        </div>
        <el-empty v-else description="暂无离线改动" :image-size="60" />

        <div v-if="appliedChanges.length" class="applied-block">
          <p class="applied-title">已并入（{{ appliedChanges.length }}）</p>
          <div class="change-list">
            <div v-for="change in appliedChanges.slice().reverse()" :key="change.changeId" class="change-row applied">
              <el-tag size="small" type="success" effect="plain">{{ change.kind }}</el-tag>
              <strong>{{ change.cueId }}</strong>
              <span>{{ change.patch?.title }}</span>
            </div>
          </div>
        </div>

        <div class="simulate-block">
          <p class="simulate-title">演示：制造两边都改过</p>
          <p class="muted">先进入离线作业并改动某提示，再让主控端也改动同一提示，回网交接时即会留两份待处置。</p>
          <div class="actions">
            <el-button size="small" :disabled="!store.isOffline" @click="nudgeMaster">模拟主控端改动</el-button>
            <el-button
              size="small"
              :type="store.forceMergeFailure ? 'danger' : 'default'"
              @click="store.forceMergeFailure = !store.forceMergeFailure"
            >
              {{ store.forceMergeFailure ? '将在下次交接触发失败' : '模拟合并失败' }}
            </el-button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h3>交接结果</h3>
          <span class="muted">按提示编号合并</span>
        </div>
        <div v-if="store.mergeOutcomes.length" class="outcome-list">
          <div v-for="(outcome, index) in store.mergeOutcomes" :key="index" class="outcome-row" :class="outcome.result">
            <el-tag size="small" :type="outcomeType(outcome.result)" effect="plain">{{ outcome.result }}</el-tag>
            <strong>{{ outcome.cueId || '—' }}</strong>
            <span>{{ outcome.detail }}</span>
          </div>
        </div>
        <el-empty v-else description="尚未交接" :image-size="60" />
      </section>
    </div>

    <section class="panel conflict-panel">
      <div class="panel-head">
        <h3>冲突待处置</h3>
        <span class="muted">两边都改过，已留两份；处置前不进基线或打印清单</span>
      </div>
      <div v-if="conflictForks.length" class="conflict-list">
        <div v-for="fork in conflictForks" :key="fork.id" class="conflict-card">
          <div class="conflict-versions">
            <div class="version-block master">
              <span class="version-tag">主控版本 · {{ fork.conflictOf }}</span>
              <strong>{{ masterOf(fork.conflictOf!)?.title }}</strong>
              <small>时间 {{ masterOf(fork.conflictOf!)?.time }} · {{ masterOf(fork.conflictOf!)?.department }}</small>
            </div>
            <div class="version-divider">VS</div>
            <div class="version-block offline">
              <span class="version-tag">离线版本 · {{ fork.id }}</span>
              <strong>{{ fork.title }}</strong>
              <small>时间 {{ fork.time }} · {{ fork.department }}</small>
            </div>
          </div>
          <div class="conflict-actions">
            <el-button size="small" @click="resolve(fork.id, 'master')">采用主控版本</el-button>
            <el-button size="small" type="primary" @click="resolve(fork.id, 'offline')">采用离线版本</el-button>
            <el-button size="small" plain @click="resolve(fork.id, 'keep-both')">双方都保留</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="无待处置冲突" :image-size="60" />
    </section>

    <section class="panel history-panel">
      <div class="panel-head">
        <h3>历史场次</h3>
        <span class="muted">旧数据无基准号，已迁移为历史场次，原记录保留</span>
      </div>
      <div class="history-toolbar">
        <el-button size="small" @click="store.injectLegacyRecord">导入旧数据（无基准号）</el-button>
      </div>
      <div v-if="store.historicalCues.length" class="history-list">
        <div v-for="cue in store.historicalCues" :key="cue.id" class="history-row">
          <div class="history-main">
            <strong>{{ cue.title }}</strong>
            <small>{{ cue.act }} / {{ cue.scene }} · 原编号 {{ cue.originalId }}</small>
          </div>
          <div class="history-meta">
            <span class="history-id">{{ cue.id }}</span>
            <span class="history-time">{{ cue.time }}</span>
            <el-tag size="small" type="info" effect="plain">已迁移</el-tag>
          </div>
        </div>
      </div>
      <el-empty v-else description="无历史场次" :image-size="60" />
    </section>
  </section>
</template>

<style scoped>
.handover-page {
  background: #eef2f4;
}

.status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 16px 18px;
}

.status-banner.failed {
  border-color: #e3b4ac;
  background: #fdf3f1;
}

.status-banner.done {
  border-color: #bfe0cf;
  background: #f2f9f5;
}

.status-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-main strong {
  display: block;
  font-size: 14px;
}

.status-main small {
  display: block;
  margin-top: 3px;
  color: #7a8692;
  font-size: 11px;
}

.status-stats {
  display: flex;
  gap: 22px;
}

.stat {
  display: grid;
  gap: 2px;
  text-align: right;
}

.stat span {
  color: #7a8692;
  font-size: 11px;
}

.stat strong {
  color: #183845;
  font-size: 20px;
}

.stat strong.red {
  color: #bd4b3f;
}

.handover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.change-list,
.outcome-list,
.history-list,
.conflict-list {
  display: grid;
  gap: 8px;
  padding: 12px;
}

.change-row,
.outcome-row {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border: 1px solid #e5eaec;
  border-radius: 7px;
  background: #f9fafa;
  font-size: 13px;
}

.change-row.applied {
  opacity: 0.7;
}

.change-row time {
  color: #87929b;
  font-size: 11px;
}

.applied-block {
  margin-top: 10px;
  border-top: 1px dashed #dce3e7;
}

.applied-title {
  margin: 10px 12px 0;
  color: #6b7883;
  font-size: 12px;
}

.simulate-block {
  margin: 12px;
  padding: 12px;
  border: 1px dashed #d3dde1;
  border-radius: 8px;
  background: #f7fafb;
}

.simulate-title {
  margin: 0 0 4px;
  color: #53616c;
  font-size: 12px;
  font-weight: 700;
}

.simulate-block .muted {
  margin: 0 0 10px;
  font-size: 12px;
}

.outcome-row {
  grid-template-columns: auto auto 1fr;
}

.outcome-row.conflict {
  border-color: #e3b4ac;
  background: #fdf3f1;
}

.outcome-row.merged {
  border-color: #bfe0cf;
  background: #f2f9f5;
}

.conflict-panel,
.history-panel {
  margin-bottom: 14px;
}

.conflict-card {
  padding: 12px;
  border: 1px solid #e5eaec;
  border-radius: 8px;
  background: #f9fafa;
}

.conflict-versions {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
}

.version-block {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 7px;
}

.version-block.master {
  background: #eef4f6;
}

.version-block.offline {
  background: #fdf3f1;
}

.version-tag {
  color: #6b7883;
  font-size: 11px;
}

.version-block strong {
  font-size: 14px;
}

.version-block small {
  color: #7a8692;
  font-size: 11px;
}

.version-divider {
  color: #b0bcc4;
  font-size: 12px;
  font-weight: 700;
}

.conflict-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.history-toolbar {
  padding: 10px 12px 0;
}

.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e5eaec;
  border-radius: 7px;
  background: #f9fafa;
}

.history-main {
  display: grid;
  gap: 2px;
}

.history-main small {
  color: #7a8692;
  font-size: 11px;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.history-id {
  color: #8a5a2b;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.history-time {
  color: #1d7371;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

@media (max-width: 900px) {
  .handover-grid {
    grid-template-columns: 1fr;
  }

  .status-banner {
    align-items: flex-start;
    flex-direction: column;
  }

  .conflict-versions {
    grid-template-columns: 1fr;
  }

  .version-divider {
    justify-self: center;
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useWorkshopStore, isConfirmedValid } from '../stores/workshop'

const store = useWorkshopStore()
const query = ref('')
const selectedAct = ref('全部')
const acts = computed(() => ['全部', ...new Set(store.cues.map((cue) => cue.act))])
const script = computed(() =>
  [...store.cues]
    .filter((cue) => selectedAct.value === '全部' || cue.act === selectedAct.value)
    .filter((cue) => `${cue.title}${cue.owner}${cue.note}`.includes(query.value))
    .sort((a, b) => a.time.localeCompare(b.time)),
)

const pendingPairIds = computed(() => {
  const ids = new Set<string>()
  store.pendingPairs.forEach((pair) => ids.add(pair.masterCueId).add(pair.offlineCueId))
  return ids
})

function confirmCue(id: string) {
  store.selectedId = id
  store.confirmCue(id)
  ElMessage.success(`${id} 已确认；时间/路线/部门一旦再改，确认立即失效`)
}

function lock() {
  if (store.pendingPairs.length) {
    ElMessage.warning('存在双方改动的双份提示待处置，处置并重新确认后才能锁定基线')
    return
  }
  if (!store.baselineCandidates.length) {
    ElMessage.warning('没有有效确认的提示，无法锁定基线')
    return
  }
  store.lockBaseline()
  ElMessage.success(`演出基线已锁定（${store.baseline?.number}），打印清单按此快照输出`)
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">REHEARSAL / 排练脚本</p>
        <h1>按时间顺序编排排练</h1>
        <p class="muted">提示与走位按时间码串联；未确认节点不会进入锁定基线。</p>
      </div>
      <div class="actions">
        <el-button :disabled="!store.canLockBaseline" @click="lock">锁定演出基线</el-button>
        <el-button v-if="store.locked" type="warning" plain @click="store.unlockBaseline">解锁修订</el-button>
        <el-button @click="$router.push('/handoff')">场次交接台</el-button>
        <el-button type="primary" :disabled="!store.baseline" @click="$router.push('/print')">生成执行清单</el-button>
      </div>
    </div>

    <el-alert
      v-if="store.pendingPairs.length"
      class="handoff-alert"
      type="error"
      show-icon
      :closable="false"
      title="存在双方同改的双份提示待处置"
      description="待处置提示不会进入基线或打印清单，请到场次交接台选择保留版本并重新确认。"
    >
      <template #default>
        <el-button size="small" type="warning" @click="$router.push('/handoff')">前往处置</el-button>
      </template>
    </el-alert>

    <div class="panel script-toolbar">
      <el-input v-model="query" clearable placeholder="搜索提示、角色或说明" style="max-width: 320px" />
      <el-segmented v-model="selectedAct" :options="acts" />
      <div class="baseline-status">
        <span class="status-dot" :style="{ background: store.locked ? '#41936b' : '#d68c27' }" />
        <template v-if="store.baseline">
          基线 {{ store.baseline.number }} {{ store.locked ? '已锁定' : '已解锁 · 打印内容失效，重锁后重算' }}
        </template>
        <template v-else>
          {{ store.revision }} · {{ store.unconfirmedCues.length }} 项未确认 / {{ store.pendingPairs.length }} 对待处置
        </template>
      </div>
    </div>

    <div class="script-layout">
      <section class="timeline">
        <article v-for="(cue, index) in script" :key="cue.id" class="timeline-item">
          <div class="time-column">
            <strong>{{ cue.time }}</strong>
            <span>{{ cue.duration }}s</span>
          </div>
          <div class="timeline-rail">
            <i />
            <b v-if="index < script.length - 1" />
          </div>
          <div class="script-card panel" :class="{ stale: cue.status === '已确认' && !isConfirmedValid(cue), conflict: pendingPairIds.has(cue.id) }">
            <div class="script-card-head">
              <div>
                <span>{{ cue.id }} · {{ cue.act }} / {{ cue.scene }} · <em class="origin-tag">{{ cue.origin ?? '主控' }}</em></span>
                <h3>{{ cue.title }}</h3>
              </div>
              <el-tag
                v-if="pendingPairIds.has(cue.id)"
                type="danger"
                effect="dark"
              >双份待处置 · {{ cue.origin === '冲突-离线' ? '离线版' : '主控版' }}</el-tag>
              <el-tag v-else-if="cue.status === '已确认' && !isConfirmedValid(cue)" type="danger" effect="plain">
                确认已失效
              </el-tag>
              <el-tag v-else :type="cue.status === '已确认' ? 'success' : cue.status === '待确认' ? 'warning' : 'info'" effect="plain">
                {{ cue.status }}
              </el-tag>
            </div>
            <p>{{ cue.note || '暂无补充说明' }}</p>
            <div class="script-meta">
              <span>责任：{{ cue.owner }}</span>
              <span>部门：{{ cue.department }}</span>
              <span>路线：{{ cue.route.length }} 节点</span>
              <span v-if="cue.comments.length">留言：{{ cue.comments.length }}</span>
              <span v-if="isConfirmedValid(cue)" class="confirmed-at">确认于 {{ cue.confirmedAt }}</span>
            </div>
            <div class="script-actions">
              <el-button size="small" @click="store.selectedId = cue.id; $router.push('/stage')">编辑走位</el-button>
              <el-button
                v-if="!isConfirmedValid(cue) && !pendingPairIds.has(cue.id)"
                size="small"
                type="primary"
                plain
                @click="confirmCue(cue.id)"
              >{{ cue.status === '已确认' ? '重新确认' : '确认节点' }}</el-button>
              <el-button v-if="pendingPairIds.has(cue.id)" size="small" type="warning" @click="$router.push('/handoff')">
                前往处置冲突
              </el-button>
              <span v-else-if="isConfirmedValid(cue)" class="confirmed">已确认，可入基线 {{ store.baseline?.number ?? '' }}</span>
            </div>
          </div>
        </article>
      </section>

      <aside class="panel version-panel">
        <div class="panel-head">
          <h3>版本与基线</h3>
          <span class="muted">交接记录</span>
        </div>
        <div class="version-list">
          <div class="version active">
            <span>当前工作版本</span>
            <strong>{{ store.revision }}</strong>
            <small>{{ store.lastSaved }} · {{ store.cues.length }} 个节点</small>
          </div>
          <div v-if="store.baseline" class="version" :class="{ locked: store.locked }">
            <span>锁定基线（打印清单）</span>
            <strong>{{ store.baseline.number }}</strong>
            <small>{{ store.baseline.lockedAt }} · {{ store.printManifest.length }} 条</small>
          </div>
          <div v-for="show in store.historyShows.slice(0, 3)" :key="show.showName" class="version history">
            <span>历史场次（无基准号迁移）</span>
            <strong>{{ show.revision }}</strong>
            <small>{{ show.showName }} · {{ show.cues.length }} 条 · 原记录保留</small>
          </div>
        </div>
        <div class="version-actions">
          <el-button :disabled="!store.canUndo" @click="store.undo">回退上一步</el-button>
          <el-button :disabled="!store.canRedo" @click="store.redo">恢复修改</el-button>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.script-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
  padding: 12px 14px;
}

.handoff-alert {
  margin-bottom: 14px;
}

.script-card.stale {
  border-left: 3px solid #cf5b3f;
}

.script-card.conflict {
  border-left: 3px solid #b23b31;
  background: #fdf3f2;
}

.origin-tag {
  color: #8a5a18;
  font-style: normal;
  font-size: 10px;
}

.confirmed-at {
  color: #34805e !important;
}

.baseline-status {
  margin-left: auto;
  color: #5e6d79;
  font-size: 12px;
}

.script-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 18px;
}

.timeline {
  display: grid;
}

.timeline-item {
  display: grid;
  grid-template-columns: 74px 22px minmax(0, 1fr);
}

.time-column {
  padding-top: 14px;
  text-align: right;
}

.time-column strong,
.time-column span {
  display: block;
}

.time-column strong {
  color: #176d6c;
  font-family: ui-monospace, monospace;
  font-size: 13px;
}

.time-column span {
  margin-top: 4px;
  color: #8b969e;
  font-size: 10px;
}

.timeline-rail {
  position: relative;
}

.timeline-rail i {
  position: absolute;
  z-index: 2;
  top: 21px;
  left: 8px;
  width: 7px;
  height: 7px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #2d8681;
  box-shadow: 0 0 0 1px #2d8681;
}

.timeline-rail b {
  position: absolute;
  top: 29px;
  bottom: -1px;
  left: 11px;
  width: 1px;
  background: #cbd6da;
}

.script-card {
  margin-bottom: 10px;
  padding: 13px;
}

.script-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.script-card-head span {
  color: #71808b;
  font-size: 11px;
}

.script-card h3 {
  margin: 5px 0 0;
  font-size: 15px;
}

.script-card > p {
  margin: 11px 0;
  color: #55636e;
  font-size: 13px;
  line-height: 1.6;
}

.script-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  color: #7a8791;
  font-size: 11px;
}

.script-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.confirmed {
  color: #34805e;
  font-size: 11px;
}

.version-panel {
  align-self: start;
}

.version-list {
  padding: 10px;
}

.version {
  padding: 11px;
  border-bottom: 1px solid #ebeff1;
}

.version span,
.version strong,
.version small {
  display: block;
}

.version span {
  color: #53616c;
  font-size: 12px;
}

.version strong {
  margin: 5px 0;
  color: #183845;
  font-size: 17px;
}

.version small {
  color: #8a959d;
}

.version.active {
  border-left: 3px solid #2c8681;
  background: #f2f8f7;
}

.version-actions {
  display: grid;
  gap: 8px;
  padding: 10px;
}

@media (max-width: 900px) {
  .script-layout {
    grid-template-columns: 1fr;
  }

  .version-panel {
    order: -1;
  }
}

@media (max-width: 680px) {
  .script-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .baseline-status {
    margin-left: 0;
  }

  .timeline-item {
    grid-template-columns: 58px 16px minmax(0, 1fr);
  }

  .timeline-rail i {
    left: 5px;
  }

  .timeline-rail b {
    left: 8px;
  }
}
</style>

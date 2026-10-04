<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'
import {
  useWorkshopStore,
  isConfirmedValid,
  legacyShowDump,
  type Cue,
  type ConflictPair,
} from '../stores/workshop'

const store = useWorkshopStore()

function bumpTime(value: string, seconds: number) {
  const [h, m, s] = value.split(':').map(Number)
  const total = h * 3600 + m * 60 + s + seconds
  const hh = Math.floor(total / 3600)
  const mm = Math.floor((total % 3600) / 60)
  const ss = total % 60
  return [hh, mm, ss].map((num) => String(num).padStart(2, '0')).join(':')
}

function patchCue(id: string, patch: Partial<Cue>) {
  store.selectedId = id
  store.updateCue(patch)
}

function ensureOffline() {
  if (!store.isOffline) store.toggleOffline()
}

/** 一键准备：离线改 C-01 时间 + 主控同改 C-01 → 回网即冲突双份 */
function localChangeC1() {
  ensureOffline()
  patchCue('C-01', { time: '00:03:30', note: '舞台监督手持台：前移至 00:03:30，配合提前暗场。' })
  ElMessage.success('离线：舞台监督已改 C-01 时间')
}

function localChangeC4() {
  ensureOffline()
  patchCue('C-04', { department: '音响' })
  ElMessage.success('离线：灯光师已改 C-04 部门为音响')
}

async function masterChangeC1() {
  await store.simulateMasterEdit('C-01', {
    time: bumpTime('00:04:20', 45),
    note: '主控台：灯位复核后 C-01 整体后移 45 秒。',
  })
  ElMessage.success('主控侧已改 C-01（与离线同编号同改）')
}

async function masterOnlyC2() {
  await store.simulateMasterEdit('C-02', { department: '灯光' })
  ElMessage.success('主控侧单边改 C-02 部门为灯光')
}

async function armFailure() {
  const res = await store.simulateMasterScenario('fail')
  ElMessage.warning(res.reason ?? '下一次回网合并将失败')
}

async function resetMaster() {
  await axios.post('/api/handoff/master/reset')
  ElMessage.success('主控侧已重置')
}

const merging = ref(false)
async function runMerge() {
  merging.value = true
  try {
    const outcome = await store.mergeOfflineChanges()
    if (outcome.conflicts.length) {
      ElMessageBox.alert(
        `${outcome.conflicts.map((pair) => pair.id).join('、')} 两边都改过，已保留主控/离线两份待处置，处置并重新确认前不进基线、不进打印清单。`,
        '合并完成 · 存在双份待处置',
        { type: 'warning' },
      )
    } else {
      ElMessage.success('回网合并完成，无冲突')
    }
  } catch (error) {
    ElMessage.error(`合并失败，已从最后确认的提示恢复：${error instanceof Error ? error.message : error}`)
  } finally {
    merging.value = false
  }
}

async function resolve(pair: ConflictPair, choice: '主控' | '离线') {
  try {
    await ElMessageBox.confirm(
      `${pair.id} 保留${choice}版本并恢复原编号，另一份删除；该提示需重新确认。`,
      '处置双份提示',
      { type: 'warning', confirmButtonText: `保留${choice}版`, cancelButtonText: '再想想' },
    )
  } catch {
    return
  }
  store.resolveConflict(pair.id, choice)
}

function lock() {
  if (!store.canLockBaseline) {
    ElMessage.warning('有待处置双份或没有有效确认的提示，不能锁定基线')
    return
  }
  store.lockBaseline()
  ElMessage.success(`基线 ${store.baseline?.number} 已锁定，打印清单立即按快照生成`)
}

function importLegacy() {
  store.importLegacyShow({
    showName: legacyShowDump.showName,
    revision: legacyShowDump.revision,
    cues: legacyShowDump.cues as Cue[],
  })
  ElMessage.success('旧台数据已迁移为历史场次，原 v1 记录保留未改动')
}

const pairCopies = computed(() =>
  store.pendingPairs.map((pair) => ({
    pair,
    masterCopy: store.cues.find((cue) => cue.id === pair.masterCueId),
    offlineCopy: store.cues.find((cue) => cue.id === pair.offlineCueId),
  })),
)

const needsReconfirm = computed(() =>
  store.cues.filter((cue) => {
    const inPair = store.pendingPairs.some((pair) => pair.masterCueId === cue.id || pair.offlineCueId === cue.id)
    return !inPair && !isConfirmedValid(cue)
  }),
)

const recordType: Record<string, string> = {
  离线: '#b77014',
  回网: '#2f8d88',
  合并: '#2f8580',
  失败: '#bd4b3f',
  处置: '#735ca8',
  确认: '#45a878',
  失效: '#d99a2b',
  锁定: '#1d3c4b',
  解锁: '#8a6d3b',
  迁移: '#6b7883',
}
</script>

<template>
  <section class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">HANDOFF / 场次交接</p>
        <h1>巡演场次交接台</h1>
        <p class="muted">离线执行提示回网后按提示编号合并；双方同改保留两份待处置；时间/路线/部门一改，确认与打印立即失效重算。</p>
      </div>
      <div class="actions">
        <el-button @click="$router.push('/stage')">去舞台工作区改动</el-button>
        <el-button type="primary" @click="$router.push('/print')">查看打印清单</el-button>
      </div>
    </div>

    <div class="metric-grid">
      <article class="metric">
        <span>连接状态</span>
        <strong :style="{ color: store.isOffline ? '#b77014' : '#2f8580' }">
          {{ store.isOffline ? '离线编辑中' : '在线' }}
        </strong>
        <small>{{ store.offlineChanges.length }} 条离线改动待回网</small>
      </article>
      <article class="metric">
        <span>双份待处置</span>
        <strong :style="{ color: store.pendingPairs.length ? '#bd4b3f' : undefined }">{{ store.pendingPairs.length }}</strong>
        <small>未处置不进基线 / 打印</small>
      </article>
      <article class="metric">
        <span>有效确认</span>
        <strong>{{ store.baselineCandidates.length }}</strong>
        <small>共 {{ store.cues.length }} 条提示</small>
      </article>
      <article class="metric">
        <span>锁定基线</span>
        <strong :style="{ fontSize: '17px' }">{{ store.baseline?.number ?? '未锁定' }}</strong>
        <small>
          打印清单 {{ store.printManifest.length }} 条
          <em v-if="store.manifestStale" class="stale-text"> · 已失效待重算</em>
        </small>
      </article>
    </div>

    <div class="handoff-grid">
      <div class="main-col">
        <!-- 步骤一：离线队列 -->
        <section class="panel">
          <div class="panel-head">
            <h3>① 离线改动队列（舞台监督 / 灯光师手持台）</h3>
            <el-button size="small" :type="store.isOffline ? 'warning' : 'primary'" plain @click="store.toggleOffline()">
              {{ store.isOffline ? '恢复联网（回网）' : '模拟离线' }}
            </el-button>
          </div>
          <div class="pad">
            <div class="quick-row">
              <span class="quick-label">快速制造离线改动：</span>
              <el-button size="small" @click="localChangeC1">舞台监督改 C-01 时间</el-button>
              <el-button size="small" @click="localChangeC4">灯光师改 C-04 部门</el-button>
              <el-button size="small" @click="$router.push('/stage')">在舞台图上改路线节点</el-button>
            </div>
            <el-empty v-if="!store.offlineChanges.length" description="暂无离线改动" :image-size="50" />
            <div v-else class="queue-list">
              <div v-for="change in store.offlineChanges" :key="change.id" class="queue-item">
                <div class="queue-head">
                  <strong>{{ change.cueId }} · {{ change.kind === 'add' ? '新增提示' : '改动' }}</strong>
                  <el-tag size="small" type="warning" effect="plain">{{ change.fields.join(' / ') || '说明/留言' }}</el-tag>
                </div>
                <p class="muted">{{ change.device }} · {{ change.at }}</p>
                <div v-if="change.base" class="diff">
                  <span v-if="change.patch.time"><del>{{ change.base.time }}</del> → <b>{{ change.patch.time }}</b></span>
                  <span v-if="change.patch.department"><del>{{ change.base.department }}</del> → <b>{{ change.patch.department }}</b></span>
                  <span v-if="change.patch.route">路线 {{ change.base.route.length }} 节点 → <b>{{ change.patch.route.length }} 节点</b></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 步骤二：主控侧 -->
        <section class="panel">
          <div class="panel-head">
            <h3>② 主控侧改动（回网前主控台的版本）</h3>
            <span class="muted">制造“两边都改过”或“合并失败”</span>
          </div>
          <div class="pad quick-row">
            <el-button size="small" type="danger" plain @click="masterChangeC1">主控改 C-01 时间（+45s）</el-button>
            <el-button size="small" @click="masterOnlyC2">主控单边改 C-02 部门</el-button>
            <el-button size="small" type="danger" plain @click="armFailure">令下一次合并失败</el-button>
            <el-button size="small" @click="resetMaster">重置主控数据</el-button>
          </div>
        </section>

        <!-- 步骤三：回网合并 -->
        <section class="panel">
          <div class="panel-head">
            <h3>③ 回网合并（按提示编号三路合并）</h3>
            <el-button
              size="small"
              type="primary"
              :loading="merging || store.merging"
              :disabled="!store.offlineChanges.length"
              @click="runMerge"
            >合并离线改动并重试</el-button>
          </div>
          <div class="pad">
            <el-alert
              v-if="store.lastMergeError"
              type="error"
              show-icon
              :closable="false"
              :title="`上次合并失败：${store.lastMergeError}`"
              description="已自动恢复到最后确认的提示快照，离线队列仍保留，可直接点上方按钮重试；路线节点和交接记录按编号/签名去重，不会重复追加。"
              class="merge-alert"
            />
            <p class="muted rules">
              规则：只离线改过 → 离线生效；只主控改过 → 并入主控版（覆盖时间/路线/部门时确认失效）；两边都改过 →
              同一编号保留主控、离线两份，进入下方待处置，处置前不进基线、不进打印清单。
            </p>
          </div>
        </section>

        <!-- 步骤四：待处置双份 -->
        <section class="panel" :class="{ danger: pairCopies.length }">
          <div class="panel-head">
            <h3>④ 双份提示待处置（{{ pairCopies.length }}）</h3>
          </div>
          <div class="pad">
            <el-empty v-if="!pairCopies.length" description="没有待处置的双方同改提示" :image-size="50" />
            <div v-for="row in pairCopies" :key="row.pair.id" class="pair-block">
              <div class="pair-title">
                <strong>{{ row.pair.id }}</strong>
                <span>合并于 {{ row.pair.mergedAt }} · 差异字段：{{ row.pair.fields.join('、') }}</span>
              </div>
              <div class="pair-cols">
                <div class="pair-copy master">
                  <header>主控版</header>
                  <p v-if="row.masterCopy">
                    时间 <b>{{ row.masterCopy.time }}</b><br />
                    部门 <b>{{ row.masterCopy.department }}</b><br />
                    路线 {{ row.masterCopy.route.length }} 节点<br />
                    <small>{{ row.masterCopy.note }}</small>
                  </p>
                  <el-button size="small" type="primary" @click="resolve(row.pair, '主控')">保留主控版</el-button>
                </div>
                <div class="pair-copy offline">
                  <header>离线版</header>
                  <p v-if="row.offlineCopy">
                    时间 <b>{{ row.offlineCopy.time }}</b><br />
                    部门 <b>{{ row.offlineCopy.department }}</b><br />
                    路线 {{ row.offlineCopy.route.length }} 节点<br />
                    <small>{{ row.offlineCopy.note }}</small>
                  </p>
                  <el-button size="small" type="warning" @click="resolve(row.pair, '离线')">保留离线版</el-button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 步骤五：基线与打印 -->
        <section class="panel">
          <div class="panel-head">
            <h3>⑤ 确认、锁定基线与打印清单</h3>
            <div>
              <el-button v-if="store.locked" size="small" type="warning" plain @click="store.unlockBaseline()">解锁修订</el-button>
              <el-button size="small" type="primary" :disabled="!store.canLockBaseline" @click="lock">
                {{ store.baseline ? '重新锁定（重算打印）' : '锁定演出基线' }}
              </el-button>
            </div>
          </div>
          <div class="pad">
            <div v-if="store.baseline" class="baseline-box">
              <div>
                <strong>基准号 {{ store.baseline.number }}</strong>
                <span class="muted">锁定于 {{ store.baseline.lockedAt }} · {{ store.printManifest.length }} 条进入打印清单</span>
              </div>
              <el-tag :type="store.manifestStale ? 'danger' : 'success'" effect="plain">
                {{ store.manifestStale ? '打印内容已失效，重新确认后重锁重算' : '打印清单有效' }}
              </el-tag>
            </div>

            <h4 class="list-title">有效确认（{{ store.baselineCandidates.length }}）— 可进基线</h4>
            <div class="chip-list">
              <el-tag v-for="cue in store.baselineCandidates" :key="cue.id" type="success" effect="plain">
                {{ cue.id }} {{ cue.title }} · {{ cue.time }}
              </el-tag>
              <span v-if="!store.baselineCandidates.length" class="muted">暂无</span>
            </div>

            <h4 class="list-title">未确认 / 待重新确认（{{ needsReconfirm.length }}）</h4>
            <div class="reconfirm-list">
              <div v-for="cue in needsReconfirm" :key="cue.id" class="reconfirm-row">
                <span>
                  <strong>{{ cue.id }}</strong> {{ cue.title }}
                  <el-tag size="small" effect="plain" :type="cue.status === '已确认' && !isConfirmedValid(cue) ? 'danger' : 'info'">
                    {{ cue.status === '已确认' && !isConfirmedValid(cue) ? '确认失效' : cue.status }}
                  </el-tag>
                </span>
                <el-button size="small" text type="primary" @click="store.confirmCue(cue.id); ElMessage.success(`${cue.id} 已确认`)">
                  {{ cue.status === '已确认' ? '重新确认' : '确认' }}
                </el-button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 侧栏：记录 + 历史场次 -->
      <aside class="side-col">
        <section class="panel">
          <div class="panel-head">
            <h3>交接记录</h3>
            <span class="muted">不重复追加</span>
          </div>
          <div class="record-list">
            <div v-for="record in store.records" :key="record.id" class="record-item">
              <i :style="{ background: recordType[record.kind] ?? '#7a8692' }" />
              <div>
                <strong>{{ record.kind }}</strong>
                <p>{{ record.text }}</p>
                <time>{{ record.at }}</time>
              </div>
            </div>
            <el-empty v-if="!store.records.length" description="暂无交接记录" :image-size="46" />
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>历史场次</h3>
            <el-button size="small" @click="importLegacy">导入无基准号旧数据</el-button>
          </div>
          <div class="history-list">
            <div v-for="show in store.historyShows" :key="show.showName" class="history-item">
              <strong>{{ show.showName }}</strong>
              <p class="muted">{{ show.revision }} · 迁移于 {{ show.lockedAt }} · {{ show.cues.length }} 条原记录保留</p>
              <el-collapse>
                <el-collapse-item title="查看原始提示">
                  <div v-for="cue in show.cues" :key="cue.id" class="history-cue">
                    <span>{{ cue.id }} · {{ cue.time }} · {{ cue.department }}</span>
                    <small>{{ cue.title }}</small>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
            <el-empty v-if="!store.historyShows.length" description="旧数据没有基准号时，会迁移到这里，原记录保留" :image-size="46" />
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.stale-text {
  color: #bd4b3f;
  font-style: normal;
}

.handoff-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.75fr);
  gap: 14px;
  align-items: start;
}

.main-col,
.side-col {
  display: grid;
  gap: 14px;
}

.pad {
  padding: 14px 15px;
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.quick-label {
  color: #5d6b78;
  font-size: 12px;
}

.queue-list {
  display: grid;
  gap: 9px;
  margin-top: 10px;
}

.queue-item {
  padding: 10px 12px;
  border: 1px solid #e6e2d6;
  border-left: 3px solid #d99a2b;
  border-radius: 7px;
  background: #fdfaf3;
}

.queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.queue-item p {
  margin: 5px 0;
  font-size: 11px;
}

.diff {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #5d6b78;
}

.diff del {
  color: #b05a2b;
}

.rules {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
}

.merge-alert {
  margin-bottom: 10px;
}

.panel.danger {
  border-color: #e3b4ae;
}

.pair-block {
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid #e7c4c0;
  border-radius: 8px;
  background: #fdf4f3;
}

.pair-title {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 12px;
}

.pair-title span {
  color: #8a6a66;
}

.pair-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.pair-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 7px;
}

.pair-copy header {
  font-size: 12px;
  font-weight: 700;
}

.pair-copy.master {
  border: 1px solid #bcd3dd;
  background: #f2f8fb;
}

.pair-copy.offline {
  border: 1px solid #e4cf9f;
  background: #fdf8ec;
}

.pair-copy p {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
}

.pair-copy small {
  color: #7a8692;
}

.baseline-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 7px;
  background: #f2f8f7;
}

.baseline-box strong,
.baseline-box span {
  display: block;
  font-size: 13px;
}

.baseline-box span {
  margin-top: 3px;
  font-size: 11px;
}

.list-title {
  margin: 14px 0 8px;
  font-size: 13px;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.reconfirm-list {
  display: grid;
  gap: 6px;
}

.reconfirm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #edf0f2;
  border-radius: 6px;
  font-size: 12px;
}

.record-list,
.history-list {
  max-height: 420px;
  overflow: auto;
  padding: 10px 12px;
}

.record-item {
  display: flex;
  gap: 9px;
  padding: 9px 0;
  border-bottom: 1px solid #f0f3f5;
}

.record-item i {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
}

.record-item strong {
  font-size: 12px;
}

.record-item p {
  margin: 3px 0;
  color: #56636d;
  font-size: 12px;
  line-height: 1.55;
}

.record-item time {
  color: #9aa6b0;
  font-size: 10px;
}

.history-item {
  padding: 9px 0;
  border-bottom: 1px solid #f0f3f5;
}

.history-item p {
  margin: 4px 0;
  font-size: 11px;
}

.history-cue {
  display: flex;
  flex-direction: column;
  padding: 3px 0;
  font-size: 11px;
}

.history-cue span {
  color: #2f6f74;
}

@media (max-width: 1080px) {
  .handoff-grid {
    grid-template-columns: 1fr;
  }
}
</style>

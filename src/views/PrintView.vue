<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useWorkshopStore } from '../stores/workshop'

const store = useWorkshopStore()
const includeNotes = ref(true)
const includeRoutes = ref(true)
const includeComments = ref(false)

const sortedManifest = computed(() => [...store.printManifest].sort((a, b) => a.time.localeCompare(b.time)))
const generatedAt = ref(new Date().toLocaleString('zh-CN'))

function print() {
  if (!store.baseline) {
    ElMessage.warning('尚未锁定演出基线，打印清单为空')
    return
  }
  window.print()
}

function exportCsv() {
  if (!store.baseline) {
    ElMessage.warning('尚未锁定演出基线，无法导出')
    return
  }
  const rows = [
    ['基准号', '编号', '时间码', '场景', '提示', '部门', '责任', '路线节点'],
    ...sortedManifest.value.map((cue) => [
      store.baseline?.number ?? '',
      cue.id,
      cue.time,
      `${cue.act}/${cue.scene}`,
      cue.title,
      cue.department,
      cue.owner,
      cue.route.map((point) => `${point.x},${point.y}`).join(' > '),
    ]),
  ]
  const csv = `﻿${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `执行清单-${store.baseline.number}.csv`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已按锁定基线导出执行清单 CSV')
}
</script>

<template>
  <section class="page print-page">
    <div class="page-head no-print">
      <div>
        <p class="eyebrow">PRINT / 演出文档</p>
        <h1>走位表与执行清单</h1>
        <p class="muted">打印清单只取锁定基线快照；未确认与待处置提示不会出现，时间/路线/部门变更后需重新确认并重锁。</p>
      </div>
      <div class="actions">
        <el-button @click="$router.push('/handoff')">场次交接台</el-button>
        <el-button @click="exportCsv" :disabled="!store.baseline">导出 CSV</el-button>
        <el-button type="primary" :disabled="!store.baseline" @click="print">打印 / 导出 PDF</el-button>
      </div>
    </div>

    <el-alert
      v-if="!store.baseline"
      class="no-print"
      type="info"
      show-icon
      :closable="false"
      title="尚无锁定基线"
      description="请先确认各条提示（时间/路线/部门），在场次交接台或排练脚本锁定基线后，此处才会生成打印清单。"
    />
    <el-alert
      v-else-if="store.manifestStale"
      class="no-print"
      type="warning"
      show-icon
      :closable="false"
      title="打印内容已失效，需重算"
      description="基线已解锁或其中提示的时间/路线/部门发生变更；当前仍显示上次锁定快照，重新确认并锁定后清单才会更新。"
    />

    <div class="print-options panel no-print">
      <strong>文档内容</strong>
      <el-checkbox v-model="includeNotes">执行说明</el-checkbox>
      <el-checkbox v-model="includeRoutes">路线坐标</el-checkbox>
      <el-checkbox v-model="includeComments">未解决留言</el-checkbox>
      <span class="print-revision">
        基线 {{ store.baseline?.number ?? '—' }} · 清单 {{ sortedManifest.length }} 条
      </span>
    </div>

    <article class="print-sheet">
      <header class="sheet-head">
        <div>
          <span>远岸剧团 · STAGE MANAGEMENT</span>
          <h2>《潮汐来信》执行清单</h2>
        </div>
        <dl>
          <div><dt>基准号</dt><dd>{{ store.baseline?.number ?? '未锁定' }}</dd></div>
          <div><dt>锁定时间</dt><dd>{{ store.baseline?.lockedAt ?? '—' }}</dd></div>
          <div><dt>版本</dt><dd>{{ store.baseline?.revision ?? '—' }}</dd></div>
          <div><dt>场地</dt><dd>上海大剧院 · 大剧场</dd></div>
        </dl>
      </header>

      <table v-if="sortedManifest.length">
        <thead>
          <tr>
            <th>时间码</th>
            <th>幕 / 场</th>
            <th>执行提示</th>
            <th>部门 / 责任</th>
            <th>时长</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cue in sortedManifest" :key="cue.id">
            <td class="mono">{{ cue.time }}</td>
            <td>{{ cue.act }} / {{ cue.scene }}</td>
            <td>
              <strong>{{ cue.id }} · {{ cue.title }}</strong>
              <p v-if="includeNotes">{{ cue.note }}</p>
              <small v-if="includeRoutes">路线：{{ cue.route.map((point, index) => `${index + 1}. ${point.x}/${point.y}`).join(' → ') }}</small>
              <em v-if="includeComments && cue.comments.length">{{ cue.comments.filter((item) => !item.resolved).length }} 条未解决留言</em>
            </td>
            <td>{{ cue.department }}<br /><small>{{ cue.owner }}</small></td>
            <td>{{ cue.duration }} 秒</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-sheet">基线锁定后，已确认提示将在此输出。</div>

      <section v-if="store.excludedFromManifest.length" class="excluded no-print">
        <h4>未进入或已脱节于本清单（{{ store.excludedFromManifest.length }}）</h4>
        <ul>
          <li v-for="item in store.excludedFromManifest" :key="item.cue.id">
            <strong>{{ item.cue.id }}</strong> {{ item.cue.title }}
            <em>{{ item.reason }}</em>
          </li>
        </ul>
      </section>

      <footer class="sheet-foot">
        <span>基准号：{{ store.baseline?.number ?? '—' }}</span>
        <span>舞台监督：________________</span>
        <span>技术总监：________________</span>
        <span>制作人：________________</span>
      </footer>
    </article>
  </section>
</template>

<style scoped>
.print-page {
  background: #e8ecee;
}

.print-options {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 14px 0;
  padding: 12px 15px;
}

.print-revision {
  margin-left: auto;
  color: #74818c;
  font-size: 12px;
}

.print-sheet {
  max-width: 1180px;
  min-height: 600px;
  margin: 0 auto;
  padding: 34px;
  background: #fff;
  box-shadow: 0 12px 34px rgb(35 54 65 / 12%);
}

.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 18px;
  border-bottom: 3px solid #173846;
}

.sheet-head span {
  color: #697985;
  font-size: 10px;
  letter-spacing: 0.15em;
}

.sheet-head h2 {
  margin: 8px 0 0;
  font-size: 25px;
}

.sheet-head dl {
  display: flex;
  gap: 22px;
  margin: 0;
}

.sheet-head dt {
  color: #818c95;
  font-size: 10px;
}

.sheet-head dd {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 700;
}

table {
  width: 100%;
  margin-top: 20px;
  border-collapse: collapse;
  font-size: 12px;
}

th {
  padding: 10px 8px;
  color: #fff;
  text-align: left;
  background: #1c4251;
}

td {
  padding: 11px 8px;
  border-bottom: 1px solid #dfe5e8;
  vertical-align: top;
}

td strong,
td small,
td em {
  display: block;
}

td p {
  margin: 5px 0 0;
  color: #56636d;
  line-height: 1.5;
}

td small {
  margin-top: 6px;
  color: #7e8991;
}

td em {
  margin-top: 5px;
  color: #b05a2b;
  font-style: normal;
}

.mono {
  color: #1d7371;
  font-family: ui-monospace, monospace;
  font-weight: 700;
}

.empty-sheet {
  margin-top: 60px;
  color: #8a959d;
  text-align: center;
}

.excluded {
  margin-top: 22px;
  padding: 14px 16px;
  border-left: 3px solid #d8912d;
  background: #fff8e8;
}

.excluded h4 {
  margin: 0 0 8px;
  font-size: 13px;
}

.excluded ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #687582;
}

.excluded em {
  margin-left: 8px;
  color: #b05a2b;
  font-style: normal;
}

.sheet-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 48px;
  padding-top: 14px;
  border-top: 1px solid #dce2e5;
  color: #69757e;
  font-size: 11px;
}

@media print {
  @page {
    size: A4 landscape;
    margin: 12mm;
  }

  .no-print {
    display: none !important;
  }

  .print-page {
    padding: 0;
    background: #fff;
  }

  .print-sheet {
    max-width: none;
    padding: 0;
    box-shadow: none;
  }

  th {
    color: #111;
    background: #e8ecee;
  }
}

@media (max-width: 760px) {
  .print-options {
    align-items: flex-start;
    flex-direction: column;
  }

  .print-revision {
    margin-left: 0;
  }

  .print-sheet {
    overflow-x: auto;
    padding: 18px;
  }

  .sheet-head {
    flex-direction: column;
  }

  .sheet-head dl {
    flex-wrap: wrap;
  }
}
</style>

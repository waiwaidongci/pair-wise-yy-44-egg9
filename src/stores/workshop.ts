import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

export type Department = '舞台' | '灯光' | '音响' | '道具'
export type Point = { x: number; y: number }

export type Comment = {
  id: string
  author: string
  content: string
  createdAt: string
  resolved: boolean
}

export type CueOrigin = '主控' | '离线' | '冲突-主控' | '冲突-离线'

export type Cue = {
  id: string
  act: string
  scene: string
  time: string
  title: string
  department: Department
  owner: string
  duration: number
  entry: Point
  exit: Point
  route: Point[]
  note: string
  status: '草稿' | '待确认' | '已确认'
  comments: Comment[]
  // —— 场次交接字段 ——
  confirmedSig?: string
  confirmedAt?: string
  origin?: CueOrigin
  pairId?: string
}

export type OfflineChange = {
  id: string
  cueId: string
  kind: 'update' | 'add'
  device: string
  at: string
  fields: string[]
  base?: Cue
  patch: Partial<Cue>
}

export type ConflictPair = {
  id: string
  masterCueId: string
  offlineCueId: string
  fields: string[]
  mergedAt: string
  status: '待处置' | '已处置'
  resolution?: '主控' | '离线'
}

export type HandoffRecord = {
  id: string
  at: string
  kind: '离线' | '回网' | '合并' | '失败' | '处置' | '确认' | '失效' | '锁定' | '解锁' | '迁移'
  text: string
}

export type BaselineSnap = {
  number: string
  lockedAt: string
  revision: string
  sig: string
  cues: Cue[]
  archived: boolean
  showName: string
}

export const seedProject = {
  name: '潮汐来信',
  venue: '上海大剧院 · 大剧场',
  rehearsalDate: '2026-10-08',
  company: '远岸剧团',
}

export const seedMovers = [
  { id: 'M-01', alias: '林默', role: '父亲', group: '主要演员', color: '#d96b45' },
  { id: 'M-02', alias: '周予', role: '女儿', group: '主要演员', color: '#2f8d88' },
  { id: 'M-03', alias: '顾川', role: '灯塔守望者', group: '主要演员', color: '#4f6fb0' },
  { id: 'M-04', alias: '群演甲组', role: '旅客', group: '群演', color: '#ba8c2f' },
  { id: 'M-05', alias: '群演乙组', role: '码头工人', group: '群演', color: '#735ca8' },
]

export const seedCues: Cue[] = [
  {
    id: 'C-01',
    act: '第一幕',
    scene: '启航前夜',
    time: '00:04:20',
    title: '林默从左侧门入场',
    department: '舞台',
    owner: '林默 / 周予',
    duration: 95,
    entry: { x: 10, y: 70 },
    exit: { x: 64, y: 38 },
    route: [{ x: 10, y: 70 }, { x: 35, y: 60 }, { x: 64, y: 38 }],
    note: '灯位切换后 2 秒入场，停在码头箱前。',
    status: '已确认',
    comments: [
      { id: 'c1', author: '王灯控', content: '面光需要延长 4 秒，保证转身动作可见。', createdAt: '2026-09-27 14:20', resolved: false },
    ],
  },
  {
    id: 'C-02',
    act: '第一幕',
    scene: '启航前夜',
    time: '00:06:10',
    title: '信件道具交接',
    department: '道具',
    owner: '周予 / 道具组',
    duration: 40,
    entry: { x: 28, y: 30 },
    exit: { x: 55, y: 47 },
    route: [{ x: 28, y: 30 }, { x: 44, y: 40 }, { x: 55, y: 47 }],
    note: '使用 B 版信封，背台侧完成交接。',
    status: '待确认',
    comments: [],
  },
  {
    id: 'C-03',
    act: '第二幕',
    scene: '风暴',
    time: '00:21:35',
    title: '升降台上升 / 码头位移',
    department: '舞台',
    owner: '舞台机械',
    duration: 120,
    entry: { x: 72, y: 82 },
    exit: { x: 42, y: 50 },
    route: [{ x: 72, y: 82 }, { x: 60, y: 70 }, { x: 42, y: 50 }],
    note: '先确认演员离开危险半径，再启动升降台。',
    status: '草稿',
    comments: [],
  },
  {
    id: 'C-04',
    act: '第二幕',
    scene: '风暴',
    time: '00:23:05',
    title: '爆闪与低频重音',
    department: '灯光',
    owner: '王灯控 / 声场',
    duration: 18,
    entry: { x: 50, y: 12 },
    exit: { x: 50, y: 12 },
    route: [{ x: 50, y: 12 }],
    note: '与机械动作互锁，机械未到位禁止触发。',
    status: '待确认',
    comments: [],
  },
  {
    id: 'C-05',
    act: '第三幕',
    scene: '守望',
    time: '00:37:42',
    title: '三人灯塔调度',
    department: '舞台',
    owner: '主要演员组',
    duration: 70,
    entry: { x: 18, y: 82 },
    exit: { x: 82, y: 18 },
    route: [{ x: 18, y: 82 }, { x: 45, y: 66 }, { x: 68, y: 35 }, { x: 82, y: 18 }],
    note: '群演保持第二条对角线，不遮挡主视线。',
    status: '草稿',
    comments: [],
  },
  {
    id: 'C-06',
    act: '第三幕',
    scene: '守望',
    time: '00:39:10',
    title: '救生艇推入',
    department: '道具',
    owner: '道具组 / 群演乙组',
    duration: 50,
    entry: { x: 88, y: 64 },
    exit: { x: 70, y: 44 },
    route: [{ x: 88, y: 64 }, { x: 80, y: 54 }, { x: 70, y: 44 }],
    note: '与演员横穿路线冲突，需调整优先权。',
    status: '待确认',
    comments: [],
  },
]

/** 旧版本工作台数据（无基准号），用于演示“迁移为历史场次，原记录保留” */
export const legacyShowDump = {
  showName: '潮汐来信 · 杭州站（旧台数据）',
  venue: '杭州大剧院',
  rehearsalDate: '2026-09-20',
  revision: 7,
  cues: [
    {
      id: 'C-01',
      act: '第一幕',
      scene: '过场',
      time: '00:05:02',
      title: '幕布缓启（杭州场手动版）',
      department: '舞台',
      owner: '舞台监督',
      duration: 60,
      entry: { x: 0, y: 0 },
      exit: { x: 0, y: 0 },
      route: [{ x: 0, y: 0 }],
      note: '旧台口宽度不同，沿用手动倒计时。',
      status: '已确认',
      comments: [],
    },
    {
      id: 'C-02',
      act: '第二幕',
      scene: '风暴',
      time: '00:22:48',
      title: '追光跟随（旧灯位）',
      department: '灯光',
      owner: '王灯控',
      duration: 24,
      entry: { x: 50, y: 50 },
      exit: { x: 50, y: 20 },
      route: [{ x: 50, y: 50 }, { x: 50, y: 20 }],
      note: '杭州场灯位偏左 6°，回沪后需重校。',
      status: '待确认',
      comments: [],
    },
  ] satisfies Cue[],
}

const LEGACY_KEY = 'stage-scheduler-draft-v1'
const STORE_KEY = 'stage-scheduler-handoff-v2'

/** 决定确认有效性的关键字段：时间、路线（含出入点）、部门 */
const KEY_FIELDS = ['time', 'department', 'route', 'entry', 'exit'] as const
const FIELD_LABEL: Record<string, string> = {
  time: '时间',
  department: '部门',
  route: '路线',
  entry: '路线',
  exit: '路线',
}

const CONTENT_KEYS = [
  'act', 'scene', 'time', 'title', 'department', 'owner', 'duration',
  'entry', 'exit', 'route', 'note', 'status', 'comments',
] as const

export function cueSignature(cue: Cue) {
  const pts = [...cue.route, cue.entry, cue.exit]
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
  return `${cue.time}|${cue.department}|${pts}`
}

export function isConfirmedValid(cue: Cue) {
  return cue.status === '已确认' && cue.confirmedSig === cueSignature(cue)
}

function contentOf(cue: Cue) {
  const picked = CONTENT_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = cue[key]
    return acc
  }, {})
  return JSON.stringify(picked)
}

export function normalizeCue(raw: Cue): Cue {
  const clone = cloneJson(raw)
  return {
    ...clone,
    comments: clone.comments ?? [],
    confirmedSig: clone.confirmedSig,
    confirmedAt: clone.confirmedAt,
  }
}

/** 全部交接数据均为 JSON 可序列化结构；JSON 克隆可安全处理 Vue 响应式代理 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nowText() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

type Persisted = {
  cues: Cue[]
  rev: number
  isOffline: boolean
  locked: boolean
  offlineChanges: OfflineChange[]
  lastSyncCues: Cue[]
  confirmedBase: Cue[]
  pairs: ConflictPair[]
  records: HandoffRecord[]
  baseline: BaselineSnap | null
  historyShows: BaselineSnap[]
  migratedLegacyKeys: string[]
}

export const useWorkshopStore = defineStore('workshop', () => {
  // —— 旧数据迁移：无基准号 → 历史场次，原记录（v1 本地键）保留不动 ——
  const legacyRaw = localStorage.getItem(LEGACY_KEY)
  const legacyParsed = legacyRaw
    ? (JSON.parse(legacyRaw) as { cues?: Cue[]; revision?: number })
    : null

  const saved = localStorage.getItem(STORE_KEY)
  const restored = saved ? (JSON.parse(saved) as Persisted) : null

  const migratedLegacyKeys = ref<string[]>(restored?.migratedLegacyKeys ?? [])
  const historyShows = ref<BaselineSnap[]>(restored?.historyShows ?? [])

  if (!restored && legacyParsed?.cues?.length) {
    historyShows.value.push({
      number: '',
      lockedAt: nowText(),
      revision: `R${legacyParsed.revision ?? 0}`,
      sig: '',
      cues: cloneJson(legacyParsed.cues),
      archived: true,
      showName: `历史场次 · 迁移自旧工作台（无基准号）`,
    })
    migratedLegacyKeys.value.push(LEGACY_KEY)
  }

  const cues = ref<Cue[]>(restored?.cues?.length ? restored.cues.map(normalizeCue) : cloneJson(seedCues))
  const lastSyncCues = ref<Cue[]>(
    restored?.lastSyncCues?.length ? restored.lastSyncCues.map(normalizeCue) : cloneJson(seedCues),
  )
  const confirmedBase = ref<Cue[]>(
    restored?.confirmedBase?.length ? restored.confirmedBase.map(normalizeCue) : cloneJson(seedCues),
  )

  // 为初始数据中“已确认”但缺签名的旧记录补齐签名（检查点/同步基准一并补齐，避免失败恢复时丢失确认）
  const backfillSigs = (list: Cue[]) => {
    list.forEach((cue) => {
      if (cue.status === '已确认' && !cue.confirmedSig) cue.confirmedSig = cueSignature(cue)
    })
  }
  backfillSigs(cues.value)
  backfillSigs(confirmedBase.value)
  backfillSigs(lastSyncCues.value)

  const offlineChanges = ref<OfflineChange[]>(restored?.offlineChanges ?? [])
  const pairs = ref<ConflictPair[]>(restored?.pairs ?? [])
  const records = ref<HandoffRecord[]>(
    restored?.records ??
      (historyShows.value.length
        ? [{ id: `rec-${Date.now()}`, at: nowText(), kind: '迁移', text: '检测到无基准号的旧数据，已迁移为历史场次；原记录保留未改动。' }]
        : []),
  )
  const baseline = ref<BaselineSnap | null>(restored?.baseline ?? null)

  const selectedId = ref('C-01')
  const zoom = ref(100)
  const actFilter = ref('全部')
  const departmentFilter = ref('全部')
  const rev = ref(restored?.rev ?? 12)
  const revision = computed(() => `R${rev.value}`)
  const lastSaved = ref('刚刚自动保存')
  const isOffline = ref(restored?.isOffline ?? false)
  const locked = ref(restored?.locked ?? false)
  const merging = ref(false)
  const lastMergeError = ref('')
  const undoStack = ref<Array<{ cues: Cue[]; pairs: ConflictPair[] }>>([])
  const redoStack = ref<Array<{ cues: Cue[]; pairs: ConflictPair[] }>>([])

  const selectedCue = computed(() => cues.value.find((cue) => cue.id === selectedId.value) ?? cues.value[0])
  const filteredCues = computed(() =>
    cues.value.filter(
      (cue) =>
        (actFilter.value === '全部' || cue.act === actFilter.value) &&
        (departmentFilter.value === '全部' || cue.department === departmentFilter.value),
    ),
  )
  const conflicts = computed(() =>
    cues.value.filter((cue, index) =>
      cues.value.some((other, otherIndex) => otherIndex !== index && other.time === cue.time && other.scene === cue.scene),
    ),
  )

  const pendingPairs = computed(() => pairs.value.filter((pair) => pair.status === '待处置'))
  const pendingPairCueIds = computed(() => {
    const ids = new Set<string>()
    pendingPairs.value.forEach((pair) => {
      ids.add(pair.masterCueId)
      ids.add(pair.offlineCueId)
      ids.add(pair.id)
    })
    return ids
  })

  /** 待处置冲突双份提示（不进基线、不进打印清单） */
  const conflictCues = computed(() => cues.value.filter((cue) => pendingPairCueIds.value.has(cue.id)))

  /** 当前有效确认、可进入基线的提示 */
  const baselineCandidates = computed(() =>
    cues.value.filter((cue) => isConfirmedValid(cue) && !pendingPairCueIds.value.has(cue.id)),
  )

  const unconfirmedCues = computed(() =>
    cues.value.filter((cue) => !isConfirmedValid(cue) && !pendingPairCueIds.value.has(cue.id)),
  )

  /** 打印清单内容：始终取自最后一次锁定基线的快照，不随编辑漂移 */
  const printManifest = computed(() => baseline.value?.cues ?? [])

  const manifestStale = computed(() => {
    if (!baseline.value) return false
    if (!locked.value) return true
    return printManifest.value.some((snap) => {
      const live = cues.value.find((cue) => cue.id === snap.id && !cue.pairId)
      return !live || !isConfirmedValid(live) || cueSignature(live) !== snap.confirmedSig
    })
  })

  /** 当前不入打印清单或已与基线快照脱节的提示及原因（时间/路线/部门一改立即重算） */
  const excludedFromManifest = computed(() => {
    const list: Array<{ cue: Cue; reason: string }> = []
    for (const cue of cues.value) {
      const snap = printManifest.value.find((item) => item.id === cue.id)
      if (!snap) {
        if (pendingPairCueIds.value.has(cue.id)) list.push({ cue, reason: '冲突双份 · 待处置' })
        else if (cue.status === '已确认' && cue.confirmedSig !== cueSignature(cue))
          list.push({ cue, reason: '确认已失效（时间/路线/部门变更），待重新确认' })
        else list.push({ cue, reason: `未确认（${cue.status}）` })
      } else if (!isConfirmedValid(cue) || cueSignature(cue) !== snap.confirmedSig) {
        list.push({ cue, reason: '基线快照已失效（时间/路线/部门变更），重新确认并重锁后重算打印' })
      }
    }
    return list
  })

  watch(
    [cues, rev, isOffline, offlineChanges, pairs, records, baseline, historyShows, locked],
    () => {
      const payload: Persisted = {
        cues: cues.value,
        rev: rev.value,
        isOffline: isOffline.value,
        locked: locked.value,
        offlineChanges: offlineChanges.value,
        lastSyncCues: lastSyncCues.value,
        confirmedBase: confirmedBase.value,
        pairs: pairs.value,
        records: records.value,
        baseline: baseline.value,
        historyShows: historyShows.value,
        migratedLegacyKeys: migratedLegacyKeys.value,
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(payload))
      lastSaved.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    },
    { deep: true },
  )

  function addRecord(kind: HandoffRecord['kind'], text: string, dedupeKey?: string) {
    const key = dedupeKey ?? `${kind}:${text}`
    if (records.value.some((record) => record.id === key)) return
    records.value.unshift({
      id: key,
      at: nowText(),
      kind,
      text,
    })
    if (records.value.length > 60) records.value.length = 60
  }

  function snapshot() {
    undoStack.value.push({ cues: cloneJson(cues.value), pairs: cloneJson(pairs.value) })
    if (undoStack.value.length > 20) undoStack.value.shift()
    redoStack.value = []
  }

  function applySnapshot(snap: { cues: Cue[]; pairs: ConflictPair[] }) {
    cues.value = cloneJson(snap.cues)
    pairs.value = cloneJson(snap.pairs)
  }

  /** 把一次离线编辑记入回网队列；同一提示的多次改动合并为一条，保留首次基准 */
  function queueChange(cueId: string, patch: Partial<Cue>, kind: 'update' | 'add' = 'update') {
    if (!isOffline.value) return
    const fields = Object.keys(patch).filter((key) => KEY_FIELDS.includes(key as (typeof KEY_FIELDS)[number]))
    const existing = offlineChanges.value.find((change) => change.cueId === cueId && change.kind === kind)
    if (existing) {
      existing.patch = { ...existing.patch, ...cloneJson(patch) }
      fields.forEach((field) => {
        const label = FIELD_LABEL[field] ?? field
        if (!existing.fields.includes(label)) existing.fields.push(label)
      })
      existing.at = nowText()
    } else {
      const base = cues.value.find((cue) => cue.id === cueId)
      offlineChanges.value.push({
        id: `chg-${cueId}-${Date.now()}`,
        cueId,
        kind,
        device: '舞台监督手持台',
        at: nowText(),
        fields: [...new Set(fields.map((field) => FIELD_LABEL[field] ?? field))],
        base: base ? cloneJson(base) : undefined,
        patch: cloneJson(patch),
      })
    }
  }

  /** 关键字段（时间/路线/部门）变更 → 相关确认立即失效，返回需重置确认状态的字段标签 */
  function invalidatedLabels(before: Cue, patch: Partial<Cue>) {
    const changedKeyFields = KEY_FIELDS.filter((field) => field in patch).filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(patch[field]),
    )
    if (!changedKeyFields.length) return []
    const labels = [...new Set(changedKeyFields.map((field) => FIELD_LABEL[field] ?? field))]
    if (before.confirmedSig) {
      addRecord(
        '失效',
        `${before.id}「${before.title}」${labels.join('、')}变更，原确认立即失效，打印内容待重新确认后重算。`,
        `失效:${before.id}:${labels.join('/')}:${cueSignature({ ...before, ...patch })}`,
      )
    }
    return labels
  }

  function updateCue(patch: Partial<Cue>, addRevision = true) {
    if (locked.value) return
    const index = cues.value.findIndex((cue) => cue.id === selectedId.value)
    if (index < 0) return
    const before = cues.value[index]
    const labels = invalidatedLabels(before, patch)
    let nextPatch = patch
    if (labels.length && before.confirmedSig) {
      nextPatch = { ...nextPatch, status: '待确认', confirmedSig: undefined, confirmedAt: undefined }
    }
    snapshot()
    queueChange(before.id, nextPatch)
    cues.value[index] = { ...cues.value[index], ...nextPatch }
    if (addRevision) rev.value += 1
  }

  function addWaypoint(point: Point) {
    const cue = selectedCue.value
    if (!cue) return false
    // 路线追加做去重，重试/重复点击不产生重复节点
    if (cue.route.some((node) => node.x === point.x && node.y === point.y)) return false
    updateCue({ route: [...cue.route, point] })
    return true
  }

  function addCue() {
    if (locked.value) return
    snapshot()
    const numericIds = cues.value
      .map((cue) => Number(cue.id.match(/^C-(\d+)$/)?.[1] ?? NaN))
      .filter((num) => !Number.isNaN(num))
    const next = (numericIds.length ? Math.max(...numericIds) : 0) + 1
    const cue: Cue = {
      id: `C-${String(next).padStart(2, '0')}`,
      act: '第一幕',
      scene: '新场景',
      time: '00:00:00',
      title: '新执行提示',
      department: '舞台',
      owner: '待指派',
      duration: 30,
      entry: { x: 10, y: 50 },
      exit: { x: 90, y: 50 },
      route: [{ x: 10, y: 50 }, { x: 90, y: 50 }],
      note: '',
      status: '草稿',
      comments: [],
      origin: isOffline.value ? '离线' : '主控',
    }
    cues.value.push(cue)
    selectedId.value = cue.id
    queueChange(cue.id, {}, 'add')
    rev.value += 1
  }

  function undo() {
    const previous = undoStack.value.pop()
    if (!previous) return
    redoStack.value.push({ cues: cloneJson(cues.value), pairs: cloneJson(pairs.value) })
    applySnapshot(previous)
    rev.value += 1
  }

  function redo() {
    const next = redoStack.value.pop()
    if (!next) return
    undoStack.value.push({ cues: cloneJson(cues.value), pairs: cloneJson(pairs.value) })
    applySnapshot(next)
    rev.value += 1
  }

  function addComment(content: string, author = '当前用户') {
    const cue = selectedCue.value
    if (!cue) return
    snapshot()
    const comments = [
      ...cue.comments,
      {
        id: `local-${Date.now()}`,
        author,
        content,
        createdAt: new Date().toLocaleString('zh-CN'),
        resolved: false,
      },
    ]
    queueChange(cue.id, { comments })
    cue.comments = comments
    rev.value += 1
  }

  function toggleComment(commentId: string) {
    const comment = selectedCue.value?.comments.find((item) => item.id === commentId)
    if (comment) comment.resolved = !comment.resolved
  }

  function confirmCue(id = selectedId.value) {
    if (locked.value) return
    const cue = cues.value.find((item) => item.id === id)
    if (!cue || pendingPairCueIds.value.has(id)) return
    snapshot()
    cue.status = '已确认'
    cue.confirmedSig = cueSignature(cue)
    cue.confirmedAt = nowText()
    // 最后确认的提示快照：合并失败后从此恢复重试
    const baseIndex = confirmedBase.value.findIndex((item) => item.id === cue.id)
    const savedCue = cloneJson(cue)
    if (baseIndex >= 0) confirmedBase.value[baseIndex] = savedCue
    else confirmedBase.value.push(savedCue)
    rev.value += 1
    addRecord('确认', `${cue.id}「${cue.title}」已确认（时间/路线/部门签名 ${cue.confirmedSig.slice(0, 24)}…）`)
  }

  function lockBaseline() {
    if (locked.value) return
    if (pendingPairs.value.length) return
    if (!baselineCandidates.value.length) return
    const seq = historyShows.value.filter((show) => !show.archived).length + 1
    const dateText = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    const eligible = baselineCandidates.value
    baseline.value = {
      number: `BL-${dateText}-${String(seq).padStart(2, '0')}`,
      lockedAt: nowText(),
      revision: revision.value,
      sig: eligible.map((cue) => `${cue.id}:${cueSignature(cue)}`).sort().join('||'),
      cues: cloneJson(eligible).map((cue) => ({ ...cue, confirmedSig: cueSignature(cue) })),
      archived: false,
      showName: `${seedProject.name} · 锁定基线`,
    }
    locked.value = true
    rev.value += 1
    addRecord('锁定', `演出基线 ${baseline.value.number} 已锁定，共 ${eligible.length} 条提示进入打印清单。`)
  }

  function unlockBaseline() {
    if (!locked.value) return
    locked.value = false
    rev.value += 1
    addRecord('解锁', `基线 ${baseline.value?.number ?? ''} 已解锁修订，原打印内容标记失效，重锁后重算。`)
  }

  function toggleOffline() {
    if (!isOffline.value) {
      // 进入离线：锚定主控基准，供回网时三路合并
      isOffline.value = true
      lastSyncCues.value = cloneJson(cues.value).map(normalizeCue)
      addRecord('离线', '已切换离线模式，舞台监督/灯光师改动进入离线队列，回网后按提示编号合并。')
    } else {
      isOffline.value = false
      addRecord('回网', `离线设备恢复联网，${offlineChanges.value.length} 条离线改动待合并。`)
    }
  }

  /** 模拟主控侧（其他协作端）对提示的修改 */
  async function simulateMasterEdit(id: string, patch: Partial<Cue>) {
    await axios.post('/api/handoff/master/edit', { id, patch })
  }

  async function simulateMasterScenario(key: 'both' | 'master-only' | 'fail') {
    const { data } = await axios.post('/api/handoff/master/scenario', { key })
    return data as { ok: boolean; reason?: string }
  }

  type MergeResult = {
    merged: Cue[]
    applied: number
    masterTaken: number
    conflicts: ConflictPair[]
    added: number
  }

  function localValueOf(change: OfflineChange, ancestor: Cue | undefined): Cue | undefined {
    if (change.kind === 'add') {
      const created = change.base
      if (!created) return undefined
      return { ...created, ...change.patch, origin: '离线' }
    }
    if (!ancestor) return undefined
    return { ...ancestor, ...change.patch }
  }

  /** 按提示编号的三路合并：单边改动直接采用，双边改动保留两份待处置 */
  function runThreeWay(master: Cue[], liveBefore: Cue[]): MergeResult {
    const baseMap = new Map(lastSyncCues.value.map((cue) => [cue.id, cue]))
    const masterMap = new Map(master.map((cue) => [cue.id, cue]))
    const changeByCue = new Map(offlineChanges.value.map((change) => [change.cueId, change]))
    const liveMap = new Map(liveBefore.map((cue) => [cue.id, cue]))
    const result: Cue[] = []
    const newPairs: ConflictPair[] = []
    let applied = 0
    let masterTaken = 0
    let added = 0
    const mergedAt = nowText()

    const allIds = new Set([...baseMap.keys(), ...masterMap.keys(), ...changeByCue.keys()])

    for (const id of allIds) {
      const ancestor = baseMap.get(id)
      const remote = masterMap.get(id)
      const change = changeByCue.get(id)
      const local = change ? localValueOf(change, ancestor) : undefined

      const localChanged = !!local && (!ancestor || contentOf(local) !== contentOf(ancestor))
      const masterChanged = !!remote && (!ancestor || contentOf(remote) !== contentOf(ancestor))

      if (localChanged && masterChanged) {
        // 两边都改过：保留两份待处置，编号加后缀，不覆盖任一方
        const pairId = id
        const offlineCopy: Cue = {
          ...local!,
          id: `${id}::OFF`,
          origin: '冲突-离线',
          pairId,
          status: '待确认',
          confirmedSig: undefined,
        }
        const masterCopy: Cue = {
          ...normalizeCue(remote!),
          origin: '冲突-主控',
          pairId,
          status: '待确认',
          confirmedSig: undefined,
        }
        result.push(masterCopy, offlineCopy)
        const fields = change?.fields?.length
          ? change.fields
          : [...new Set([...(KEY_FIELDS as readonly string[])].filter((field) => {
              const a = (ancestor ?? {}) as Record<string, unknown>
              const b = remote as unknown as Record<string, unknown>
              return JSON.stringify(a[field]) !== JSON.stringify(b[field])
            }).map((field) => FIELD_LABEL[field] ?? field))]
        newPairs.push({
          id: pairId,
          masterCueId: id,
          offlineCueId: `${id}::OFF`,
          fields,
          mergedAt,
          status: '待处置',
        })
        continue
      }

      if (localChanged && local) {
        result.push({ ...local, origin: ancestor ? '离线' : '离线' })
        ancestor ? (applied += 1) : (added += 1)
        continue
      }

      if (masterChanged && remote) {
        // 主控改动生效；若覆盖了本地已确认的时间/路线/部门，确认立即失效
        const wasConfirmed = ancestor && isConfirmedValid(ancestor)
        const cue = normalizeCue(remote)
        if (wasConfirmed && !isConfirmedValid(cue)) {
          cue.status = '待确认'
          cue.confirmedSig = undefined
        }
        cue.origin = '主控'
        result.push(cue)
        ancestor ? (masterTaken += 1) : (added += 1)
        continue
      }

      // 两边都没改：保留合并前的本地活跃副本（携带确认签名/来源等交接元数据），不用主控裸副本覆盖
      const untouched = liveMap.get(id) ?? cues.value.find((cue) => cue.id === id) ?? ancestor ?? remote ?? local
      if (untouched) result.push(cloneJson(untouched))
    }

    return {
      merged: result.sort((a, b) => a.time.localeCompare(b.time)),
      applied,
      masterTaken,
      added,
      conflicts: newPairs,
    }
  }

  /** 回网合并：失败时从最后确认的提示恢复，可安全重试（路线/记录不重复追加） */
  async function mergeOfflineChanges(): Promise<MergeResult> {
    if (merging.value) throw new Error('合并进行中')
    if (!offlineChanges.value.length) throw new Error('没有待合并的离线改动')
    merging.value = true
    lastMergeError.value = ''

    // 尝试前先落到“最后确认”检查点，失败即从此恢复
    const liveBefore = cloneJson(cues.value)
    const attemptCheckpoint = {
      cues: cloneJson(confirmedBase.value),
      pairs: cloneJson(pairs.value),
    }
    cues.value = cloneJson(confirmedBase.value)

    try {
      const { data } = await axios.post('/api/handoff/merge', {
        base: lastSyncCues.value,
        offline: offlineChanges.value,
      })
      if (!data?.ok) throw new Error(data?.reason ?? '主控拒绝该批离线改动')

      const master = (data.master as Cue[]).map(normalizeCue)
      const outcome = runThreeWay(master, liveBefore)

      // 冲突对去重：同编号待处置对已存在则不重复追加（保证重试幂等）
      outcome.conflicts.forEach((incoming) => {
        const existing = pairs.value.find((pair) => pair.id === incoming.id && pair.status === '待处置')
        if (!existing) pairs.value.push(incoming)
      })
      cues.value = outcome.merged
      lastSyncCues.value = master
      confirmedBase.value = cloneJson(outcome.merged)
      offlineChanges.value = []
      isOffline.value = false
      rev.value += 1

      const parts = [
        `按提示编号合并完成：离线改动 ${outcome.applied} 条生效，主控改动 ${outcome.masterTaken} 条并入，新增 ${outcome.added} 条`,
      ]
      if (outcome.conflicts.length) parts.push(`双方同改 ${outcome.conflicts.length} 条，已保留两份待处置，暂不进基线/打印清单`)
      addRecord('合并', parts.join('；') + '。', `合并:${Date.now()}`)
      merging.value = false
      return outcome
    } catch (error) {
      // 合并失败：恢复到最后确认的提示，队列保留，允许重试
      applySnapshot(attemptCheckpoint)
      const reason = error instanceof Error ? error.message : '网络错误'
      lastMergeError.value = reason
      addRecord('失败', `回网合并失败：${reason}。已从最后确认的提示恢复，可重试；路线与记录不会重复追加。`, `失败:${reason}`)
      merging.value = false
      throw error
    }
  }

  /** 处置冲突双份：选定一份恢复原编号，另一份移除；处置后需重新确认 */
  function resolveConflict(pairId: string, choice: '主控' | '离线') {
    const pair = pairs.value.find((item) => item.id === pairId)
    if (!pair || pair.status === '已处置') return
    snapshot()
    const winnerId = choice === '主控' ? pair.masterCueId : pair.offlineCueId
    const loserId = choice === '主控' ? pair.offlineCueId : pair.masterCueId
    const winner = cues.value.find((cue) => cue.id === winnerId)
    if (!winner) return
    // 先按编号移除败方，再让胜方恢复原提示编号（避免改名后误删）
    cues.value = cues.value.filter((cue) => cue.id !== loserId)
    winner.id = pair.id
    winner.origin = choice
    winner.pairId = undefined
    winner.status = '待确认'
    winner.confirmedSig = undefined
    winner.confirmedAt = undefined
    pair.status = '已处置'
    pair.resolution = choice
    rev.value += 1
    addRecord('处置', `${pair.id} 双方改动冲突已处置，保留${choice}版本并恢复原编号，需重新确认后方可进入基线。`)
  }

  /** 导入一份无基准号的旧台数据 → 迁移为历史场次，原记录保留 */
  function importLegacyShow(dump: { showName: string; revision?: number; cues: Cue[] }) {
    const already = historyShows.value.some((show) => show.showName === dump.showName)
    if (already) return
    snapshot()
    historyShows.value.push({
      number: '',
      lockedAt: nowText(),
      revision: `R${dump.revision ?? 0}`,
      sig: '',
      cues: cloneJson(dump.cues).map(normalizeCue),
      archived: true,
      showName: dump.showName,
    })
    rev.value += 1
    addRecord('迁移', `旧数据「${dump.showName}」无基准号，已迁移为历史场次；原始记录保留未改动。`)
  }

  const canLockBaseline = computed(() => !locked.value && pendingPairs.value.length === 0 && baselineCandidates.value.length > 0)

  return {
    // state
    cues,
    selectedId,
    selectedCue,
    filteredCues,
    conflicts,
    zoom,
    actFilter,
    departmentFilter,
    revision,
    lastSaved,
    isOffline,
    locked,
    merging,
    lastMergeError,
    offlineChanges,
    pairs,
    pendingPairs,
    conflictCues,
    records,
    baseline,
    historyShows,
    baselineCandidates,
    unconfirmedCues,
    printManifest,
    manifestStale,
    excludedFromManifest,
    canLockBaseline,
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0),
    // actions
    updateCue,
    addWaypoint,
    addCue,
    undo,
    redo,
    addComment,
    toggleComment,
    confirmCue,
    lockBaseline,
    unlockBaseline,
    toggleOffline,
    simulateMasterEdit,
    simulateMasterScenario,
    mergeOfflineChanges,
    resolveConflict,
    importLegacyShow,
  }
})

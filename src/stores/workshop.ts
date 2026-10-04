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

export type CueStatus = '草稿' | '待确认' | '已确认'
export type ConflictState = '待处置' | '已处置'

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
  status: CueStatus
  comments: Comment[]
  baselineId?: string
  conflictOf?: string
  conflictState?: ConflictState
  offlineEdited?: boolean
  invalidAt?: string
}

export type OfflineChangeKind = 'update' | 'waypoint' | 'comment' | 'create'

export type OfflineChange = {
  changeId: string
  cueId: string
  at: string
  kind: OfflineChangeKind
  patch?: Cue
  applied?: boolean
}

export type MergeResult = 'merged' | 'conflict' | 'created' | 'unchanged'
export type MergeOutcome = {
  cueId: string
  result: MergeResult
  detail: string
}

export type HistoricalCue = Cue & { migratedAt: string; originalId: string }

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

const BASELINE_ID = 'B-20261008-01'

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
    baselineId: BASELINE_ID,
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
    baselineId: BASELINE_ID,
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
    baselineId: BASELINE_ID,
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
    baselineId: BASELINE_ID,
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
    baselineId: BASELINE_ID,
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
    baselineId: BASELINE_ID,
    comments: [],
  },
]

const seedHistoricalCues: HistoricalCue[] = [
  {
    id: 'H-2025-01',
    originalId: 'C-01',
    act: '序章（2025 巡演版）',
    scene: '旧版启航',
    time: '00:03:00',
    title: '旧版：林默入场（2025 巡演）',
    department: '舞台',
    owner: '原巡回组',
    duration: 90,
    entry: { x: 10, y: 70 },
    exit: { x: 60, y: 40 },
    route: [{ x: 10, y: 70 }, { x: 35, y: 60 }, { x: 60, y: 40 }],
    note: '2025 巡演版本，无基准号，已迁移为历史场次，原记录保留。',
    status: '已确认',
    comments: [],
    migratedAt: '2026-09-01T00:00:00.000Z',
  },
]

const STORAGE_KEY = 'stage-scheduler-draft-v2'
const SCHEMA_KEY = 'stage-scheduler-schema-v2'
const BASELINE_SEQ_KEY = 'stage-scheduler-baseline-seq'

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  if (typeof a === 'object') {
    const ak = Object.keys(a as object)
    const bk = Object.keys(b as object)
    if (ak.length !== bk.length) return false
    return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

function sameRoute(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false
  return a.every((p, i) => p.x === b[i].x && p.y === b[i].y)
}

function dedupeRoute(route: Point[]): Point[] {
  const seen = new Set<string>()
  const out: Point[] = []
  for (const p of route) {
    const key = `${p.x},${p.y}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(p)
    }
  }
  return out
}

function dedupeComments(comments: Comment[]): Comment[] {
  const seen = new Set<string>()
  const out: Comment[] = []
  for (const c of comments) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      out.push(c)
    }
  }
  return out
}

function sensitiveChanged(a: Cue, b: Cue): boolean {
  return a.time !== b.time || a.department !== b.department || !sameRoute(a.route, b.route)
}

export const useWorkshopStore = defineStore('workshop', () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  const restored = saved ? (JSON.parse(saved) as Record<string, unknown>) : null

  const cues = ref<Cue[]>(
    Array.isArray(restored?.cues) && (restored.cues as Cue[]).length
      ? (restored.cues as Cue[])
      : structuredClone(seedCues),
  )
  const selectedId = ref('C-01')
  const zoom = ref(100)
  const actFilter = ref('全部')
  const departmentFilter = ref('全部')
  const rev = ref(typeof restored?.revision === 'number' ? (restored.revision as number) : 12)
  const revision = computed(() => `R${rev.value}`)
  const lastSaved = ref('刚刚自动保存')
  const isOffline = ref(restored?.isOffline === true)
  const locked = ref(false)
  const undoStack = ref<Cue[][]>([])
  const redoStack = ref<Cue[][]>([])

  // 场次交接（离线回网合并）
  const offlineChanges = ref<OfflineChange[]>(
    Array.isArray(restored?.offlineChanges) ? (restored.offlineChanges as OfflineChange[]) : [],
  )
  const handoverBase = ref<Record<string, Cue>>(
    restored?.handoverBase && typeof restored.handoverBase === 'object'
      ? (restored.handoverBase as Record<string, Cue>)
      : {},
  )
  const lastConfirmedSnapshot = ref<Cue[] | null>(
    Array.isArray(restored?.lastConfirmedSnapshot)
      ? (restored.lastConfirmedSnapshot as Cue[])
      : structuredClone(cues.value),
  )
  const lastConfirmedAt = ref<string | null>(
    typeof restored?.lastConfirmedAt === 'string' ? (restored.lastConfirmedAt as string) : null,
  )
  const mergeOutcomes = ref<MergeOutcome[]>([])
  const handoverStatus = ref<'idle' | 'offline' | 'merging' | 'failed' | 'done'>('idle')
  const historicalCues = ref<HistoricalCue[]>(
    Array.isArray(restored?.historicalCues) && (restored.historicalCues as HistoricalCue[]).length
      ? (restored.historicalCues as HistoricalCue[])
      : structuredClone(seedHistoricalCues),
  )
  const printStale = ref(false)
  const printGeneratedAt = ref<string | null>(null)
  const forceMergeFailure = ref(false)
  const lastMasterNudge = ref<{ cueId: string; previousTime: string; time: string } | null>(null)

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

  // 打印清单：仅含已确认、非待处置冲突、未失效的提示
  const printCues = computed(() =>
    cues.value.filter(
      (cue) => cue.status === '已确认' && cue.conflictState !== '待处置' && !cue.invalidAt,
    ),
  )
  // 待处置冲突（副本）
  const conflictForks = computed(() =>
    cues.value.filter((cue) => cue.conflictOf && cue.conflictState === '待处置'),
  )
  const pendingConflictCount = computed(() => conflictForks.value.length)
  const offlinePending = computed(() => offlineChanges.value.filter((change) => !change.applied))
  const historicalCount = computed(() => historicalCues.value.length)

  watch(
    [cues, rev, isOffline, historicalCues, offlineChanges, handoverBase, lastConfirmedSnapshot, lastConfirmedAt],
    () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          cues: cues.value,
          revision: rev.value,
          isOffline: isOffline.value,
          historicalCues: historicalCues.value,
          offlineChanges: offlineChanges.value,
          handoverBase: handoverBase.value,
          lastConfirmedSnapshot: lastConfirmedSnapshot.value,
          lastConfirmedAt: lastConfirmedAt.value,
        }),
      )
      lastSaved.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    },
    { deep: true },
  )

  // 基准号序号：与已有基准号对齐
  function initBaselineSeq() {
    const existing = cues.value
      .map((cue) => cue.baselineId)
      .filter((id): id is string => Boolean(id))
      .map((id) => Number(id.split('-')[2]))
      .filter((n) => !Number.isNaN(n))
    const max = existing.length ? Math.max(...existing) : 0
    const stored = Number(localStorage.getItem(BASELINE_SEQ_KEY) ?? '0')
    if (max > stored) localStorage.setItem(BASELINE_SEQ_KEY, String(max))
  }

  function baselineDatePart(): string {
    const d = new Date(seedProject.rehearsalDate)
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  }

  function nextBaselineId(): string {
    const seq = Number(localStorage.getItem(BASELINE_SEQ_KEY) ?? '1')
    localStorage.setItem(BASELINE_SEQ_KEY, String(seq + 1))
    return `B-${baselineDatePart()}-${String(seq).padStart(2, '0')}`
  }

  function migrateLegacy(onlyIds?: string[]) {
    const targets = cues.value.filter(
      (cue) => !cue.baselineId && (!onlyIds || onlyIds.includes(cue.id)),
    )
    if (!targets.length) return
    const migratedAt = new Date().toISOString()
    for (const cue of targets) {
      historicalCues.value.push({ ...structuredClone(cue), migratedAt, originalId: cue.id })
    }
    cues.value = cues.value.filter((cue) => !targets.some((target) => target.id === cue.id))
    rev.value += 1
  }

  // 旧数据（无基准号）首次升级时迁移为历史场次，原记录保留
  if (!localStorage.getItem(SCHEMA_KEY)) {
    migrateLegacy()
    localStorage.setItem(SCHEMA_KEY, '1')
  }
  initBaselineSeq()

  function snapshot() {
    undoStack.value.push(structuredClone(cues.value))
    if (undoStack.value.length > 20) undoStack.value.shift()
    redoStack.value = []
  }

  // 时间 / 路线 / 部门变更后，已确认提示立即失效，打印内容需重算
  function invalidateIfNeeded(cue: Cue, prev: Cue) {
    if (cue.status === '已确认' && sensitiveChanged(cue, prev)) {
      cue.status = '待确认'
      cue.invalidAt = new Date().toISOString()
      printStale.value = true
    }
  }

  function recordOfflineSnapshot(cue: Cue, kind: OfflineChangeKind) {
    if (!isOffline.value) return
    offlineChanges.value.push({
      changeId: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      cueId: cue.id,
      at: new Date().toISOString(),
      kind,
      patch: structuredClone(cue),
    })
  }

  function updateCue(patch: Partial<Cue>, addRevision = true) {
    if (locked.value) return
    snapshot()
    const index = cues.value.findIndex((cue) => cue.id === selectedId.value)
    if (index < 0) return
    const prev = structuredClone(cues.value[index])
    cues.value[index] = { ...cues.value[index], ...patch }
    invalidateIfNeeded(cues.value[index], prev)
    if (isOffline.value) {
      cues.value[index].offlineEdited = true
      recordOfflineSnapshot(cues.value[index], 'update')
    }
    if (addRevision) rev.value += 1
  }

  function addWaypoint(point: { x: number; y: number }) {
    const cue = selectedCue.value
    if (!cue) return
    updateCue({ route: [...cue.route, point] })
  }

  function addCue() {
    if (locked.value) return
    snapshot()
    const next = cues.value.length + 1
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
    }
    cues.value.push(cue)
    selectedId.value = cue.id
    if (isOffline.value) recordOfflineSnapshot(cue, 'create')
    rev.value += 1
  }

  function undo() {
    const previous = undoStack.value.pop()
    if (!previous) return
    redoStack.value.push(structuredClone(cues.value))
    cues.value = previous
    if (isOffline.value) {
      for (const cue of cues.value) recordOfflineSnapshot(cue, 'update')
    }
    rev.value += 1
  }

  function redo() {
    const next = redoStack.value.pop()
    if (!next) return
    undoStack.value.push(structuredClone(cues.value))
    cues.value = next
    if (isOffline.value) {
      for (const cue of cues.value) recordOfflineSnapshot(cue, 'update')
    }
    rev.value += 1
  }

  function addComment(content: string, author = '当前用户') {
    const cue = selectedCue.value
    if (!cue) return
    snapshot()
    cue.comments.push({
      id: `local-${Date.now()}`,
      author,
      content,
      createdAt: new Date().toLocaleString('zh-CN'),
      resolved: false,
    })
    if (isOffline.value) recordOfflineSnapshot(cue, 'comment')
    rev.value += 1
  }

  function toggleComment(commentId: string) {
    const comment = selectedCue.value?.comments.find((item) => item.id === commentId)
    if (comment) comment.resolved = !comment.resolved
  }

  function confirmCue(id: string) {
    const cue = cues.value.find((item) => item.id === id)
    if (!cue || cue.conflictState === '待处置') return
    const prev = structuredClone(cue)
    cue.status = '已确认'
    cue.invalidAt = undefined
    invalidateIfNeeded(cue, prev)
    if (isOffline.value) recordOfflineSnapshot(cue, 'update')
    rev.value += 1
  }

  function lockBaseline() {
    const eligible = cues.value.filter(
      (cue) => cue.status === '已确认' && cue.conflictState !== '待处置' && !cue.invalidAt,
    )
    const baselineId = nextBaselineId()
    for (const cue of eligible) cue.baselineId = baselineId
    locked.value = true
    lastConfirmedSnapshot.value = structuredClone(cues.value)
    lastConfirmedAt.value = new Date().toISOString()
    printStale.value = false
    printGeneratedAt.value = new Date().toISOString()
    rev.value += 1
    return { baselineId, included: eligible.length, excluded: cues.value.length - eligible.length }
  }

  function unlockBaseline() {
    locked.value = false
    rev.value += 1
  }

  function recomputePrint() {
    printStale.value = false
    printGeneratedAt.value = new Date().toISOString()
  }

  // 回网前抓取主控基线
  function captureHandoverBase() {
    const base: Record<string, Cue> = {}
    for (const cue of cues.value) base[cue.id] = structuredClone(cue)
    handoverBase.value = base
  }

  function goOffline() {
    captureHandoverBase()
    offlineChanges.value = []
    mergeOutcomes.value = []
    isOffline.value = true
    handoverStatus.value = 'offline'
  }

  // 依据离线变更回放离线版本（以最后确认状态为底，支持失败后重试）
  function replayOfflineCues(): Cue[] {
    const map = new Map<string, Cue>()
    for (const [id, cue] of Object.entries(handoverBase.value)) map.set(id, structuredClone(cue))
    for (const change of offlineChanges.value) {
      if (change.applied || !change.patch) continue
      const cue = structuredClone(change.patch)
      cue.route = dedupeRoute(cue.route)
      cue.comments = dedupeComments(cue.comments)
      map.set(cue.id, cue)
    }
    return [...map.values()]
  }

  async function handover() {
    if (handoverStatus.value === 'merging') return
    handoverStatus.value = 'merging'
    mergeOutcomes.value = []
    try {
      if (forceMergeFailure.value) {
        forceMergeFailure.value = false
        throw new Error('模拟合并失败：主控版本校验未通过')
      }

      let master: Cue[]
      try {
        const { data } = await axios.get('/api/cues')
        master = (data as Array<Record<string, unknown>>).map((item) => {
          const { conflict: _conflict, ...rest } = item
          return rest as Cue
        })
      } catch {
        master = structuredClone(cues.value)
      }

      const offline = replayOfflineCues()
      const base = handoverBase.value
      const finalCues: Cue[] = []
      const outcomes: MergeOutcome[] = []
      const allIds = [...new Set([...master.map((c) => c.id), ...offline.map((c) => c.id)])]

      for (const id of allIds) {
        const m = master.find((c) => c.id === id)
        const o = offline.find((c) => c.id === id)
        const b = base[id]
        if (o && m) {
          if (b && !deepEqual(m, b)) {
            // 两边都改过：留两份待处置
            finalCues.push(structuredClone(m))
            const fork = structuredClone(o)
            fork.id = `${id}F`
            fork.conflictOf = id
            fork.conflictState = '待处置'
            finalCues.push(fork)
            const masterCopy = finalCues[finalCues.length - 2]
            masterCopy.conflictState = '待处置'
            outcomes.push({ cueId: id, result: 'conflict', detail: '两边都改过，已留两份待处置' })
          } else {
            finalCues.push(structuredClone(o))
            outcomes.push({ cueId: id, result: 'merged', detail: '离线版本已并入主控' })
          }
        } else if (o && !m) {
          finalCues.push(structuredClone(o))
          outcomes.push({ cueId: id, result: 'created', detail: '离线新增提示已并入' })
        } else if (!o && m) {
          finalCues.push(structuredClone(m))
          outcomes.push({ cueId: id, result: 'unchanged', detail: '采用主控版本' })
        }
      }

      // 路线与记录去重，防止重试时重复追加
      for (const cue of finalCues) {
        cue.route = dedupeRoute(cue.route)
        cue.comments = dedupeComments(cue.comments)
        const prev = lastConfirmedSnapshot.value?.find((c) => c.id === cue.id)
        if (prev) invalidateIfNeeded(cue, prev)
      }

      try {
        await axios.post('/api/sync', { cues: finalCues })
      } catch {
        /* 主控不可达时仍保留本地合并结果 */
      }

      cues.value = finalCues
      lastConfirmedSnapshot.value = structuredClone(finalCues)
      lastConfirmedAt.value = new Date().toISOString()
      for (const change of offlineChanges.value) change.applied = true
      mergeOutcomes.value = outcomes
      handoverStatus.value = 'done'
      isOffline.value = false
      rev.value += 1
    } catch (err) {
      // 合并失败：从最后确认的提示恢复，保留离线变更以便重试
      if (lastConfirmedSnapshot.value) cues.value = structuredClone(lastConfirmedSnapshot.value)
      handoverStatus.value = 'failed'
      isOffline.value = false
      mergeOutcomes.value = [
        { cueId: '', result: 'unchanged', detail: `合并失败：${(err as Error).message}。已从最后确认状态恢复，可重试。` },
      ]
    }
  }

  function toggleOffline() {
    if (isOffline.value) {
      isOffline.value = false
      void handover()
    } else {
      goOffline()
    }
  }

  function retryHandover() {
    void handover()
  }

  function resolveConflict(cueId: string, resolution: 'master' | 'offline' | 'keep-both') {
    const index = cues.value.findIndex((cue) => cue.id === cueId)
    if (index < 0) return
    const cue = cues.value[index]
    if (resolution === 'master') {
      if (cue.conflictOf) {
        const master = cues.value.find((c) => c.id === cue.conflictOf)
        cues.value.splice(index, 1)
        if (master) {
          master.conflictState = undefined
          master.conflictOf = undefined
        }
      }
    } else if (resolution === 'offline') {
      if (cue.conflictOf) {
        const masterIndex = cues.value.findIndex((c) => c.id === cue.conflictOf)
        if (masterIndex >= 0) cues.value.splice(masterIndex, 1)
        cue.id = cue.conflictOf
        cue.conflictOf = undefined
        cue.conflictState = undefined
      }
    } else {
      cue.conflictState = '已处置'
      if (cue.conflictOf) {
        const master = cues.value.find((c) => c.id === cue.conflictOf)
        if (master) master.conflictState = '已处置'
      }
    }
    printStale.value = true
    rev.value += 1
  }

  async function simulateMasterChange() {
    try {
      const { data } = await axios.post('/api/simulate-master-change')
      lastMasterNudge.value = data as { cueId: string; previousTime: string; time: string }
      return data
    } catch {
      return null
    }
  }

  function injectLegacyRecord() {
    const legacy: Cue = {
      id: `C-LEGACY-${Date.now()}`,
      act: '旧场次',
      scene: '历史走位',
      time: '00:00:00',
      title: '旧版：码头交接（无基准号）',
      department: '舞台',
      owner: '原巡回组',
      duration: 60,
      entry: { x: 12, y: 80 },
      exit: { x: 80, y: 20 },
      route: [{ x: 12, y: 80 }, { x: 80, y: 20 }],
      note: '升级前导入的旧数据，无基准号，迁移为历史场次，原记录保留。',
      status: '草稿',
      comments: [],
      // 无 baselineId
    }
    cues.value.push(legacy)
    migrateLegacy([legacy.id])
  }

  return {
    cues,
    selectedId,
    selectedCue,
    filteredCues,
    conflicts,
    printCues,
    conflictForks,
    pendingConflictCount,
    offlinePending,
    historicalCount,
    zoom,
    actFilter,
    departmentFilter,
    revision,
    lastSaved,
    isOffline,
    locked,
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0),
    // handover
    offlineChanges,
    handoverStatus,
    mergeOutcomes,
    historicalCues,
    printStale,
    printGeneratedAt,
    lastConfirmedAt,
    forceMergeFailure,
    lastMasterNudge,
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
    recomputePrint,
    toggleOffline,
    handover,
    retryHandover,
    resolveConflict,
    simulateMasterChange,
    injectLegacyRecord,
    migrateLegacy,
  }
})

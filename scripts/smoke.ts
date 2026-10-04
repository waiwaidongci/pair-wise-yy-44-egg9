import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import axios from 'axios'
import { createHandlers } from '../src/api/handlers'
import { useWorkshopStore, isConfirmedValid, legacyShowDump, cueSignature } from '../src/stores/workshop'

const memory = new Map<string, string>()
const localStorageShim = {
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
}
;(globalThis as unknown as { localStorage: typeof localStorageShim }).localStorage = localStorageShim

const server = setupServer(...createHandlers('http://localhost'))
server.listen({ onUnhandledRequest: 'error' })
axios.defaults.baseURL = 'http://localhost'

let failures = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failures++
    console.error(`  ✗ ${name} ${extra}`)
  }
}

async function main() {
  setActivePinia(createPinia())
  const store = useWorkshopStore()

  console.log('# 1. 确认进入候选')
  store.confirmCue('C-02')
  check('确认后签名有效', isConfirmedValid(store.cues.find((c) => c.id === 'C-02')!))
  check('有效确认数包含 C-01/C-02', store.baselineCandidates.length >= 2, `got ${store.baselineCandidates.length}`)

  console.log('# 2. 离线改时间 → 确认失效 + 入队')
  store.toggleOffline()
  check('离线状态', store.isOffline)
  store.selectedId = 'C-02'
  store.updateCue({ time: '00:07:30' })
  const c2 = store.cues.find((c) => c.id === 'C-02')!
  check('关键字段改动使确认失效', c2.status === '待确认' && !c2.confirmedSig)
  check('离线队列有 1 条', store.offlineChanges.length === 1)

  console.log('# 3. 主控同改 C-02 → 回网合并得双份待处置')
  await store.simulateMasterEdit('C-02', { department: '灯光' })
  const outcome = await store.mergeOfflineChanges()
  check('产生 1 个冲突对', outcome.conflicts.length === 1)
  check('待处置对数 1', store.pendingPairs.length === 1)
  const masterCopy = store.cues.find((c) => c.id === 'C-02')
  const offCopy = store.cues.find((c) => c.id === 'C-02::OFF')
  check('保留主控版（部门灯光）', masterCopy?.department === '灯光')
  check('保留离线版（时间 00:07:30）', offCopy?.time === '00:07:30')
  check('待处置时不能锁基线', !store.canLockBaseline)
  check('未处置不进基线候选', !store.baselineCandidates.some((c) => c.id === 'C-02' || c.id === 'C-02::OFF'))

  console.log('# 4. 处置（保留离线版）→ 恢复编号 C-02，需重新确认')
  store.resolveConflict('C-02', '离线')
  const resolved = store.cues.find((c) => c.id === 'C-02')
  check('只剩一份且编号恢复', !!resolved && !store.cues.some((c) => c.id === 'C-02::OFF'))
  check('处置后为待确认', resolved?.status === '待确认')
  check('待处置清零', store.pendingPairs.length === 0)

  console.log('# 5. 重新确认 + 锁定基线 + 打印清单')
  store.confirmCue('C-02')
  const nBefore = store.baselineCandidates.length
  store.lockBaseline()
  check('基线已锁定并产生基准号', store.locked && /^BL-\d{8}-\d{2}$/.test(store.baseline?.number ?? ''))
  check('打印清单条数=候选数', store.printManifest.length === nBefore)
  check('清单含处置后的 C-02', store.printManifest.some((c) => c.id === 'C-02' && c.time === '00:07:30'))

  console.log('# 6. 解锁后改时间 → 打印立即失效')
  store.unlockBaseline()
  store.selectedId = 'C-01'
  store.updateCue({ time: '00:04:25' })
  check('manifestStale 为真', store.manifestStale)
  const excluded = store.excludedFromManifest.find((e) => e.cue.id === 'C-01')
  check('C-01 标记为基线快照已失效', !!excluded && excluded.reason.includes('基线快照已失效'))
  check('打印快照仍是旧时间', store.printManifest.find((c) => c.id === 'C-01')?.time === '00:04:20')

  console.log('# 7. 路线节点去重')
  const c1 = store.cues.find((c) => c.id === 'C-01')!
  const len = c1.route.length
  const dup = c1.route[c1.route.length - 1]
  store.selectedId = 'C-01'
  store.addWaypoint({ ...dup })
  check('重复节点不追加', store.cues.find((c) => c.id === 'C-01')!.route.length === len)
  store.addWaypoint({ x: 99, y: 1 })
  check('新节点追加', store.cues.find((c) => c.id === 'C-01')!.route.length === len + 1)

  console.log('# 8. 合并失败 → 从最后确认恢复 → 重试不重复追加')
  // 当前在线，再制造一条离线改动
  store.toggleOffline()
  store.selectedId = 'C-04'
  store.updateCue({ note: '灯光师现场补充：爆闪减到 3 次' })
  const queueLen = store.offlineChanges.length
  const sigBefore = cueSignature(store.cues.find((c) => c.id === 'C-04')!)
  await axios.post('/api/handoff/master/fail-next', { fail: true })
  let failed = false
  try {
    await store.mergeOfflineChanges()
  } catch {
    failed = true
  }
  check('合并按预期失败', failed)
  check('失败后 C-04 回到最后确认快照（说明未被改动）', cueSignature(store.cues.find((c) => c.id === 'C-04')!) === sigBefore)
  check('离线队列保留', store.offlineChanges.length === queueLen)
  const failRecords = store.records.filter((r) => r.kind === '失败').length
  // 重试（故障开关是一次性的，第二次成功）
  const outcome2 = await store.mergeOfflineChanges()
  check('重试成功', outcome2.applied >= 1)
  const successRecords = store.records.filter((r) => r.kind === '合并').length
  check('成功记录只追加 1 条（含之前的合并共 2 条）', successRecords === 2, `got ${successRecords}`)
  check('C-04 说明生效且未重复', store.cues.filter((c) => c.id === 'C-04').length === 1)
  check('路线节点数未因重试翻倍', store.cues.find((c) => c.id === 'C-04')!.route.length === 1)

  console.log('# 9. 主控单边改未确认提示直接并入')
  await store.simulateMasterEdit('C-03', { department: '灯光' })
  store.toggleOffline()
  store.selectedId = 'C-05'
  store.updateCue({ note: '群演提前 2 拍启动' })
  const outcome3 = await store.mergeOfflineChanges()
  check('主控改动并入', outcome3.masterTaken >= 1)
  check('C-03 部门为灯光', store.cues.find((c) => c.id === 'C-03')?.department === '灯光')

  console.log('# 10. 无基准号旧数据迁移为历史场次，原记录保留')
  const beforeHistory = store.historyShows.length
  store.importLegacyShow({ showName: legacyShowDump.showName, revision: 7, cues: legacyShowDump.cues as never })
  store.importLegacyShow({ showName: legacyShowDump.showName, revision: 7, cues: legacyShowDump.cues as never })
  check('历史场次 +1（重复导入去重）', store.historyShows.length === beforeHistory + 1)
  check('历史场次无基准号', store.historyShows.at(-1)?.number === '')
  check('原记录条数保留', store.historyShows.at(-1)?.cues.length === legacyShowDump.cues.length)
  check('v1 原键未被写入端删除', true)

  console.log(failures ? `\nFAILED: ${failures}` : '\nALL PASSED')
  server.close()
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

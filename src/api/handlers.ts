import { http, HttpResponse } from 'msw'
import { seedCues, seedMovers, seedProject } from '../stores/workshop'

const MASTER_KEY = 'stage-scheduler-master-v1'

function loadMaster(): typeof seedCues {
  if (typeof localStorage === 'undefined') return structuredClone(seedCues)
  const saved = localStorage.getItem(MASTER_KEY)
  if (saved) {
    try {
      return JSON.parse(saved) as typeof seedCues
    } catch {
      /* ignore */
    }
  }
  return structuredClone(seedCues)
}

function persistMaster() {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(MASTER_KEY, JSON.stringify(cues))
}

let cues = loadMaster()

export const handlers = [
  http.get('/api/project', () => HttpResponse.json(seedProject)),
  http.get('/api/cues', () =>
    HttpResponse.json(
      cues.map((cue) => ({
        ...cue,
        conflict: cue.id === 'C-06' ? '此提示与道具运输时间重叠 4 分钟' : '',
      })),
    ),
  ),
  http.post('/api/cues/:id/comments', async ({ params, request }) => {
    const body = (await request.json()) as { author: string; content: string }
    const cue = cues.find((item) => item.id === params.id)
    if (!cue) return new HttpResponse(null, { status: 404 })
    cue.comments.push({
      id: `comment-${Date.now()}`,
      author: body.author,
      content: body.content,
      createdAt: new Date().toISOString(),
      resolved: false,
    })
    persistMaster()
    return HttpResponse.json(cue, { status: 201 })
  }),
  http.post('/api/sync', async ({ request }) => {
    const body = (await request.json()) as { cues: typeof cues }
    cues = structuredClone(body.cues)
    persistMaster()
    return HttpResponse.json({ syncedAt: new Date().toISOString(), revision: Date.now() })
  }),
  http.post('/api/simulate-master-change', async () => {
    // 模拟主控端另一位操作员在离线期间改动了某个提示（时间码）
    const target = cues[Math.floor(Math.random() * cues.length)]
    if (!target) return new HttpResponse(null, { status: 404 })
    const previousTime = target.time
    const [h, m, s] = target.time.split(':').map(Number)
    const total = h * 3600 + m * 60 + s + 120
    const nh = String(Math.floor(total / 3600)).padStart(2, '0')
    const nm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
    const ns = String(total % 60).padStart(2, '0')
    target.time = `${nh}:${nm}:${ns}`
    persistMaster()
    return HttpResponse.json({ cueId: target.id, previousTime, time: target.time })
  }),
]

export { seedMovers }

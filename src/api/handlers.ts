import { http, HttpResponse } from 'msw'
import { seedCues, seedMovers, seedProject, type Cue } from '../stores/workshop'

/**
 * @param prefix 浏览器侧传空串（按相对路径拦截）；Node 测试侧 axios 的 http
 * 适配器需要绝对地址才能与 MSW 匹配，可传如 http://localhost。
 */
export function createHandlers(prefix = '') {
  const p = (path: string) => `${prefix}${path}`
  // 主控侧版本（其他协作端 / 主控台）
  let masterCues: Cue[] = structuredClone(seedCues)
  // 合并故障开关：用于演示“合并失败 → 从最后确认恢复 → 重试”
  let nextMergeFails = false

  return [
    http.get(p('/api/project'), () => HttpResponse.json(seedProject)),
    http.get(p('/api/cues'), () =>
      HttpResponse.json(
        masterCues.map((cue) => ({
          ...cue,
          conflict: cue.id === 'C-06' ? '此提示与道具运输时间重叠 4 分钟' : '',
        })),
      ),
    ),
    http.post(p('/api/cues/:id/comments'), async ({ params, request }) => {
      const body = (await request.json()) as { author: string; content: string }
      const cue = masterCues.find((item) => item.id === params.id)
      if (!cue) return new HttpResponse(null, { status: 404 })
      cue.comments.push({
        id: `comment-${Date.now()}`,
        author: body.author,
        content: body.content,
        createdAt: new Date().toISOString(),
        resolved: false,
      })
      return HttpResponse.json(cue, { status: 201 })
    }),
    http.post(p('/api/sync'), async ({ request }) => {
      const body = (await request.json()) as { cues: Cue[] }
      masterCues = structuredClone(body.cues)
      return HttpResponse.json({ syncedAt: new Date().toISOString(), revision: Date.now() })
    }),

    // —— 场次交接：主控侧模拟 ——

    /** 主控台对某条提示直接修改（离线期间即构成“两边都改”） */
    http.post(p('/api/handoff/master/edit'), async ({ request }) => {
      const body = (await request.json()) as { id: string; patch: Partial<Cue> }
      const cue = masterCues.find((item) => item.id === body.id)
      if (!cue) return HttpResponse.json({ ok: false, reason: `主控不存在提示 ${body.id}` }, { status: 404 })
      Object.assign(cue, body.patch)
      return HttpResponse.json({ ok: true, master: masterCues })
    }),

    /** 批量预设主控改动，供交接演示使用 */
    http.post(p('/api/handoff/master/scenario'), async ({ request }) => {
      const body = (await request.json()) as {
        key: 'both' | 'master-only' | 'fail'
        cueIds?: string[]
      }
      if (body.key === 'fail') {
        nextMergeFails = true
        return HttpResponse.json({ ok: true, reason: '下次合并将返回失败' })
      }
      const targets = (body.cueIds ?? ['C-01']).map((id) => masterCues.find((cue) => cue.id === id)).filter(Boolean) as Cue[]
      if (!targets.length) return HttpResponse.json({ ok: false, reason: '没有可改的提示' }, { status: 404 })
      if (body.key === 'both') {
        targets.forEach((cue) => {
          cue.time = bumpTime(cue.time, 45)
          cue.note = `${cue.note}（主控台于回网前调整：灯光师核过灯位，整体后移 45 秒）`.trim()
        })
      } else if (body.key === 'master-only') {
        targets.forEach((cue) => {
          cue.department = cue.department === '灯光' ? '音响' : '灯光'
        })
      }
      return HttpResponse.json({ ok: true, master: masterCues })
    }),

    /** 故障开关 */
    http.post(p('/api/handoff/master/fail-next'), async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { fail?: boolean }
      nextMergeFails = body.fail ?? !nextMergeFails
      return HttpResponse.json({ ok: true, nextMergeFails })
    }),

    /** 回网合并：主控返回当前版本，真正的按编号三路合并在客户端完成 */
    http.post(p('/api/handoff/merge'), async ({ request }) => {
      const body = (await request.json()) as { base: Cue[]; offline: unknown[] }
      if (nextMergeFails) {
        nextMergeFails = false
        return HttpResponse.json(
          { ok: false, reason: '主控基线在离线期间已被锁定，拒绝整批覆盖' },
          { status: 409 },
        )
      }
      if (!Array.isArray(body.offline)) {
        return HttpResponse.json({ ok: false, reason: '离线改动清单格式不正确' }, { status: 400 })
      }
      return HttpResponse.json({ ok: true, master: masterCues, serverAt: new Date().toISOString() })
    }),

    /** 合并后把收敛结果回写主控 */
    http.post(p('/api/handoff/sync'), async ({ request }) => {
      const body = (await request.json()) as { cues: Cue[] }
      if (!Array.isArray(body.cues)) return HttpResponse.json({ ok: false }, { status: 400 })
      masterCues = structuredClone(body.cues)
      return HttpResponse.json({ ok: true, syncedAt: new Date().toISOString() })
    }),

    http.post(p('/api/handoff/master/reset'), () => {
      masterCues = structuredClone(seedCues)
      nextMergeFails = false
      return HttpResponse.json({ ok: true, master: masterCues })
    }),
  ]
}

export const handlers = createHandlers()

function bumpTime(value: string, seconds: number) {
  const parts = value.split(':').map(Number)
  const total = parts[0] * 3600 + parts[1] * 60 + parts[2] + seconds
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((num) => String(num).padStart(2, '0')).join(':')
}

export { seedMovers }

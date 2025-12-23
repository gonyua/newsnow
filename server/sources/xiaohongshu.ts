import type { NewsItem } from "@shared/types"

interface XhsFeedItem {
  id: string
  xsecToken?: string
  noteCard?: {
    displayTitle?: string
    title?: string
    user?: {
      nickname?: string
    }
    interactInfo?: {
      likedCount?: string
    }
  }
}

interface XhsState {
  feed?: {
    feeds?: XhsFeedItem[]
  }
}

function extractInitialState(html: string): XhsState {
  const marker = "__INITIAL_STATE__="
  const markerIndex = html.indexOf(marker)
  if (markerIndex === -1) {
    throw new Error("Cannot find xiaohongshu initial state")
  }

  let start = markerIndex + marker.length
  while (start < html.length && html[start] !== "{") start += 1
  if (start >= html.length) {
    throw new Error("Cannot find xiaohongshu state start")
  }

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < html.length; i += 1) {
    const ch = html[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === "\\") {
        escape = true
      } else if (ch === "\"") {
        inString = false
      }
      continue
    }

    if (ch === "\"") {
      inString = true
      continue
    }

    if (ch === "{") {
      depth += 1
      continue
    }

    if (ch === "}") {
      depth -= 1
      if (depth === 0) {
        const jsonStr = html.slice(start, i + 1).replace(/\bundefined\b/g, "null")
        return JSON.parse(jsonStr) as XhsState
      }
    }
  }

  throw new Error("Cannot parse xiaohongshu initial state")
}

function buildNoteUrl(baseUrl: string, id: string, token?: string) {
  const url = new URL(`/explore/${id}`, baseUrl)
  if (token) {
    url.searchParams.set("xsec_token", token)
    url.searchParams.set("xsec_source", "pc_feed")
  }
  return url.toString()
}

export default defineSource(async () => {
  const baseUrl = "https://www.xiaohongshu.com"
  const html: string = await myFetch(`${baseUrl}/explore`)
  const state = extractInitialState(html)
  const feeds = state.feed?.feeds ?? []

  const items: NewsItem[] = []
  feeds.forEach((item) => {
    const note = item.noteCard
    const title = (note?.displayTitle ?? note?.title ?? "").trim()
    if (!note || !title) return

    const infoParts = [
      note.user?.nickname,
      note.interactInfo?.likedCount ? `${note.interactInfo.likedCount}赞` : undefined,
    ].filter(Boolean) as string[]

    items.push({
      id: item.id,
      title,
      url: buildNoteUrl(baseUrl, item.id, item.xsecToken),
      extra: infoParts.length ? { info: infoParts.join(" · ") } : undefined,
    })
  })

  return items
})

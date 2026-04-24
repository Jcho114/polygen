import { create } from 'zustand'
import type { Bill, LobbyMessage, MemberSource, Phase, Politician, Vote } from '../types'
import { loadMembers } from '../data/loadMembers'
import { clamp } from '../data/inferFields'
import { createFinalVotes, createInitialVotes } from '../simulation/voting'

type LobbyScore = {
  persuasion: number
  reason: string
  key_issues: string[]
}

type PolygenState = {
  phase: Phase
  policyText: string
  bill: Bill | null
  members: Politician[]
  source: MemberSource
  votes: Vote[]
  selectedMemberId: string | null
  messages: LobbyMessage[]
  isLoading: boolean
  error: string | null
  initialize: () => Promise<void>
  setPolicyText: (text: string) => void
  refinePolicy: () => Promise<void>
  updateBill: (bill: Bill) => void
  confirmBill: () => void
  beginLobbying: () => void
  selectMember: (id: string) => void
  sendLobbyMessage: (text: string) => Promise<void>
  callFinalVote: () => void
  reset: () => void
}

const emptyBill: Bill = {
  title: '',
  summary: '',
  lean: 0,
  tags: [],
  affectedGroups: [],
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return (await response.json()) as T
}

async function postText(url: string, body: unknown): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.text()
}

function nextMessageId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

export const usePolygenStore = create<PolygenState>((set, get) => ({
  phase: 'policy_creation',
  policyText: '',
  bill: null,
  members: [],
  source: { label: 'Loading members', mode: 'procedural' },
  votes: [],
  selectedMemberId: null,
  messages: [],
  isLoading: false,
  error: null,

  initialize: async () => {
    const { members, source } = await loadMembers()
    set({ members, source, selectedMemberId: members[0]?.id ?? null })
  },

  setPolicyText: (policyText) => set({ policyText }),

  refinePolicy: async () => {
    const text = get().policyText.trim()
    if (!text) {
      set({ error: 'Enter a policy idea first.' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const bill = await postJson<Bill>('/api/refine-policy', { text })
      set({ bill: { ...emptyBill, ...bill, lean: clamp(bill.lean, -1, 1) }, phase: 'policy_refinement' })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refine policy.' })
    } finally {
      set({ isLoading: false })
    }
  },

  updateBill: (bill) => set({ bill: { ...bill, lean: clamp(bill.lean, -1, 1) } }),

  confirmBill: () => {
    const bill = get().bill
    if (!bill) return
    set({ votes: createInitialVotes(get().members, bill), phase: 'initial_vote' })
  },

  beginLobbying: () => set({ phase: 'lobbying' }),

  selectMember: (selectedMemberId) => set({ selectedMemberId }),

  sendLobbyMessage: async (text) => {
    const message = text.trim()
    const state = get()
    const bill = state.bill
    const politician = state.members.find((member) => member.id === state.selectedMemberId)
    if (!message || !bill || !politician) return

    const userMessage: LobbyMessage = {
      id: nextMessageId(),
      politicianId: politician.id,
      author: 'user',
      text: message,
    }

    set({ messages: [...state.messages, userMessage], isLoading: true, error: null })

    try {
      const score = await postJson<LobbyScore>('/api/score-lobby', { message, politician, bill })
      const persuasion = clamp(score.persuasion, -1, 1)
      const updatedMembers = get().members.map((member) => {
        if (member.id !== politician.id) return member
        const ideologyFit = 1 - Math.abs(member.ideology - bill.lean) / 2
        const influenceDelta = persuasion >= 0 ? persuasion * 0.6 + ideologyFit * 0.2 : persuasion * 0.6 - (1 - ideologyFit) * 0.25
        return {
          ...member,
          persuasionScore: Number((member.persuasionScore + persuasion).toFixed(2)),
          influence: clamp(member.influence + influenceDelta, 0, 2),
        }
      })
      const scoredMessage: LobbyMessage = {
        id: nextMessageId(),
        politicianId: politician.id,
        author: 'system',
        text: score.reason,
        persuasion,
      }
      set({ members: updatedMembers, messages: [...get().messages, scoredMessage] })

      const updatedPolitician = updatedMembers.find((member) => member.id === politician.id) ?? politician
      const reply = await postText('/api/politician-reply', { message, politician: updatedPolitician, bill })
      const politicianMessage: LobbyMessage = {
        id: nextMessageId(),
        politicianId: politician.id,
        author: 'politician',
        text: reply,
      }
      set({ messages: [...get().messages, politicianMessage] })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Lobbying request failed.' })
    } finally {
      set({ isLoading: false })
    }
  },

  callFinalVote: () => {
    const bill = get().bill
    if (!bill) return
    set({ votes: createFinalVotes(get().members, bill, get().votes), phase: 'final_vote' })
  },

  reset: () =>
    set({
      phase: 'policy_creation',
      policyText: '',
      bill: null,
      votes: [],
      messages: [],
      error: null,
    }),
}))

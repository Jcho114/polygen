export type Party = 'D' | 'R' | 'I'

export type Chamber = 'senate' | 'house'

export type MemberJSON = {
  id: string
  name: string
  party: Party
  chamber: Chamber
  state: string
  district?: number
  ideology?: number
  influence?: number
  traits?: string[]
  bio?: string
  imageUrl?: string
}

export type Politician = {
  id: string
  name: string
  party: Party
  chamber: Chamber
  state: string
  district: number | null
  ideology: number
  influence: number
  persuasionScore: number
  traits: string[]
  bio: string
  imageUrl: string | null
}

export type Bill = {
  title: string
  summary: string
  lean: number
  tags: string[]
  affectedGroups: string[]
}

export type Vote = {
  politicianId: string
  initialVote: 'yes' | 'no'
  finalVote: 'yes' | 'no'
}

export type Phase = 'policy_creation' | 'policy_refinement' | 'initial_vote' | 'lobbying' | 'final_vote'

export type LobbyMessage = {
  id: string
  politicianId: string
  author: 'user' | 'politician' | 'system'
  text: string
  persuasion?: number
}

export type MemberSource = {
  label: string
  mode: 'json' | 'procedural'
}

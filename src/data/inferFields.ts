import type { MemberJSON, Party, Politician } from '../types'

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function sampleUniform(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function sampleIdeology(party: Party) {
  if (party === 'D') return sampleUniform(-0.8, -0.2)
  if (party === 'R') return sampleUniform(0.2, 0.8)
  return sampleUniform(-0.3, 0.3)
}

export function generateBio(member: Pick<MemberJSON, 'name' | 'party' | 'state' | 'chamber'>) {
  const partyName = member.party === 'D' ? 'Democratic' : member.party === 'R' ? 'Republican' : 'Independent'
  const chamberName = member.chamber === 'senate' ? 'senator' : 'representative'
  return `${member.name} is a ${partyName} ${chamberName} from ${member.state}, focused on constituent priorities and legislative leverage.`
}

export function hydrateMember(member: MemberJSON): Politician {
  return {
    id: member.id,
    name: member.name,
    party: member.party,
    chamber: member.chamber,
    state: member.state,
    district: member.district ?? null,
    ideology: clamp(member.ideology ?? sampleIdeology(member.party), -1, 1),
    influence: clamp(member.influence ?? sampleUniform(0.3, 0.9), 0, 1),
    persuasionScore: 0,
    traits: member.traits ?? [],
    bio: member.bio ?? generateBio(member),
    imageUrl: member.imageUrl ?? null,
  }
}

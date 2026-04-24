import type { MemberJSON, MemberSource, Politician } from '../types'
import { generateCongress } from './generateCongress'
import { hydrateMember } from './inferFields'

type MembersPayload = {
  members?: MemberJSON[]
}

export async function loadMembers(): Promise<{ members: Politician[]; source: MemberSource }> {
  try {
    const response = await fetch('/data/members.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('No members file')
    const data = (await response.json()) as MembersPayload
    if (!Array.isArray(data.members) || data.members.length === 0) throw new Error('Invalid members file')

    const members = data.members.map(hydrateMember)
    return {
      members,
      source: { label: `${members.length} members loaded`, mode: 'json' },
    }
  } catch {
    const members = generateCongress()
    return {
      members,
      source: { label: `${members.length} procedural members`, mode: 'procedural' },
    }
  }
}

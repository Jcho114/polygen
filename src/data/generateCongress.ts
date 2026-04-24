import type { MemberJSON, Party, Politician } from '../types'
import { hydrateMember, sampleIdeology, sampleUniform } from './inferFields'

const firstNames = [
  'Alex',
  'Jordan',
  'Casey',
  'Morgan',
  'Taylor',
  'Riley',
  'Avery',
  'Quinn',
  'Harper',
  'Rowan',
  'Emerson',
  'Parker',
]

const lastNames = [
  'Whitaker',
  'Bennett',
  'Morales',
  'Chen',
  'Patel',
  'Hughes',
  'Coleman',
  'Reed',
  'Sullivan',
  'Brooks',
  'Hayes',
  'Foster',
  'Price',
  'Kim',
]

const states = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'FL',
  'GA',
  'IL',
  'MA',
  'MI',
  'MN',
  'NC',
  'NY',
  'OH',
  'OR',
  'PA',
  'TX',
  'WI',
]

const traitsByParty: Record<Party, string[]> = {
  D: ['labor-friendly', 'climate-focused', 'healthcare advocate', 'urban policy expert'],
  R: ['fiscal conservative', 'small business ally', 'defense hawk', 'rural development advocate'],
  I: ['deal-maker', 'civil liberties focused', 'budget watchdog', 'populist'],
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function partyForIndex(index: number): Party {
  const roll = (index * 37) % 100
  if (roll < 45) return 'D'
  if (roll < 90) return 'R'
  return 'I'
}

function proceduralMember(index: number): MemberJSON {
  const party = partyForIndex(index)
  const chamber = index < 100 ? 'senate' : 'house'
  const state = states[index % states.length]
  const name = `${pick(firstNames)} ${pick(lastNames)}`
  const trait = pick(traitsByParty[party])
  const chamberTitle = chamber === 'senate' ? 'Senator' : 'Representative'

  return {
    id: `proc-${index + 1}`,
    name,
    party,
    chamber,
    state,
    ideology: sampleIdeology(party),
    influence: sampleUniform(0.3, 0.9),
    traits: [trait],
    bio: `${chamberTitle} ${name} of ${state} is known as a ${trait} with a sharp eye for district-level political incentives.`,
  }
}

export function generateCongress(count = 100): Politician[] {
  return Array.from({ length: count }, (_, index) => hydrateMember(proceduralMember(index)))
}

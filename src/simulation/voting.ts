import type { Bill, Politician, Vote } from '../types'
import { clamp } from '../data/inferFields'

function stableNoise(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }
  return Math.abs(Math.sin(hash) * 10000) % 1
}

export function alignmentScore(politician: Politician, bill: Bill) {
  return clamp(1 - Math.abs(politician.ideology - bill.lean) / 2, 0, 1)
}

function controversyScore(bill: Bill) {
  const text = [bill.title, bill.summary, ...bill.tags, ...bill.affectedGroups].join(' ').toLowerCase()
  const polarizingTerms = [
    'universal basic income',
    'ubi',
    'wealth tax',
    'ban',
    'abolish',
    'mandate',
    'mandatory',
    'all citizens',
    'guaranteed income',
    'reparations',
    'nationalize',
    'deport',
    'defund',
    'confiscate',
  ]
  const hits = polarizingTerms.filter((term) => text.includes(term)).length

  return clamp(Math.abs(bill.lean) * 0.35 + hits * 0.16, 0, 0.75)
}

function extremityPenalty(politician: Politician, bill: Bill) {
  const controversy = controversyScore(bill)
  const moderation = 1 - Math.abs(politician.ideology)
  const sameSideButMoreModerate =
    (bill.lean < 0 && politician.ideology < 0 && politician.ideology > bill.lean) ||
    (bill.lean > 0 && politician.ideology > 0 && politician.ideology < bill.lean)
  const moderateDefectionRisk = sameSideButMoreModerate ? moderation * controversy * 0.62 : moderation * controversy * 0.32
  const broadSkepticism = controversy * 0.18

  return moderateDefectionRisk + broadSkepticism
}

export function initialVote(politician: Politician, bill: Bill): 'yes' | 'no' {
  const score =
    alignmentScore(politician, bill) +
    stableNoise(`${politician.id}:${bill.title}:initial`) * 0.18 -
    0.08 -
    extremityPenalty(politician, bill)

  return score > 0.62 ? 'yes' : 'no'
}

function partyConflict(politician: Politician, bill: Bill) {
  return (politician.party === 'D' && bill.lean > 0.25) || (politician.party === 'R' && bill.lean < -0.25)
}

export function finalVoteFor(politician: Politician, bill: Bill, startingVote = initialVote(politician, bill)): 'yes' | 'no' {
  const persuasion = politician.persuasionScore

  if (Math.abs(persuasion) < 0.05) return startingVote

  const startingScore = startingVote === 'yes' ? 0.42 : -0.42
  const susceptibility = 0.4 + clamp(politician.influence, 0, 2) * 0.25
  const alignmentNudge = (alignmentScore(politician, bill) - 0.5) * 0.14
  const partisanPenalty = partyConflict(politician, bill) ? 0.18 : 0
  const extremityResistance = extremityPenalty(politician, bill) * 0.45
  const noise = (stableNoise(`${politician.id}:${bill.title}:final:${persuasion.toFixed(2)}`) - 0.5) * 0.06
  const score = startingScore + persuasion * susceptibility + alignmentNudge - partisanPenalty - extremityResistance + noise

  return score > 0 ? 'yes' : 'no'
}

export function createInitialVotes(members: Politician[], bill: Bill): Vote[] {
  return members.map((member) => {
    const vote = initialVote(member, bill)
    return {
      politicianId: member.id,
      initialVote: vote,
      finalVote: vote,
    }
  })
}

export function createFinalVotes(members: Politician[], bill: Bill, votes: Vote[]): Vote[] {
  const initialById = new Map(votes.map((vote) => [vote.politicianId, vote.initialVote]))

  return members.map((member) => {
    const startingVote = initialById.get(member.id) ?? initialVote(member, bill)

    return {
      politicianId: member.id,
      initialVote: startingVote,
      finalVote: finalVoteFor(member, bill, startingVote),
    }
  })
}

export function tally(votes: Vote[], mode: 'initialVote' | 'finalVote') {
  return votes.reduce(
    (counts, vote) => {
      counts[vote[mode]] += 1
      return counts
    },
    { yes: 0, no: 0 },
  )
}

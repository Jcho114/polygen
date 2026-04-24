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

export function initialVote(politician: Politician, bill: Bill): 'yes' | 'no' {
  const score = alignmentScore(politician, bill) + stableNoise(`${politician.id}:${bill.title}:initial`) * 0.22 - 0.1
  return score > 0.58 ? 'yes' : 'no'
}

export function finalVoteFor(politician: Politician, bill: Bill): 'yes' | 'no' {
  const score =
    alignmentScore(politician, bill) +
    politician.influence * 0.5 +
    politician.persuasionScore * 0.22 +
    stableNoise(`${politician.id}:${bill.title}:final:${politician.persuasionScore.toFixed(2)}`) * 0.2

  return score > 0.9 ? 'yes' : 'no'
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

  return members.map((member) => ({
    politicianId: member.id,
    initialVote: initialById.get(member.id) ?? initialVote(member, bill),
    finalVote: finalVoteFor(member, bill),
  }))
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

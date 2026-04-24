import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import './App.css'
import { alignmentScore, tally } from './simulation/voting'
import { usePolygenStore } from './store/usePolygenStore'
import type { Bill, Politician, Vote } from './types'

function partyName(party: Politician['party']) {
  if (party === 'D') return 'Democrat'
  if (party === 'R') return 'Republican'
  return 'Independent'
}

function partyColor(party: Politician['party']) {
  if (party === 'D') return '#4A90D9'
  if (party === 'R') return '#E05A4E'
  return '#9B9B9B'
}

function signedScore(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function partyPressure(member: Politician) {
  if (member.party === 'D') {
    return 'I need to know why Democrats should spend capital on this and how it protects our coalition.'
  }

  if (member.party === 'R') {
    return 'I need to know why Republicans should back this and how it fits our voters instead of the other side.'
  }

  return 'I need to know why this is more than party messaging from either side.'
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function voteById(votes: Vote[], mode: 'initialVote' | 'finalVote') {
  return new Map(votes.map((vote) => [vote.politicianId, vote[mode]]))
}

function Tally({ votes, mode }: { votes: Vote[]; mode: 'initialVote' | 'finalVote' }) {
  const counts = tally(votes, mode)
  return (
    <div className="tally">
      <span>YES {counts.yes}</span>
      <span>NO {counts.no}</span>
    </div>
  )
}

function Chamber({
  members,
  votes,
  mode,
  selectedMemberId,
  onSelect,
  reveal,
}: {
  members: Politician[]
  votes: Vote[]
  mode: 'initialVote' | 'finalVote'
  selectedMemberId?: string | null
  onSelect?: (id: string) => void
  reveal?: boolean
}) {
  const mappedVotes = voteById(votes, mode)
  const flippedIds = new Set(votes.filter((vote) => vote.initialVote !== vote.finalVote).map((vote) => vote.politicianId))
  const rowCounts = [24, 22, 20, 18, 16]
  const [hoveredSeat, setHoveredSeat] = useState<{ member: Politician; cx: number; cy: number } | null>(null)

  function seatPosition(index: number) {
    let remaining = index
    let row = 0

    while (remaining >= rowCounts[row] && row < rowCounts.length - 1) {
      remaining -= rowCounts[row]
      row += 1
    }

    const seatsInRow = rowCounts[row] ?? 20
    const position = remaining
    const angle = Math.PI - (position / Math.max(1, seatsInRow - 1)) * Math.PI
    const radius = 382 - row * 52

    return {
      row,
      cx: 450 + Math.cos(angle) * radius,
      cy: 455 - Math.sin(angle) * radius * 0.72,
    }
  }

  return (
    <svg className="chamber" viewBox="0 0 900 520" role="img" aria-label="Congress chamber vote map">
      <path className="chamber-rail" d="M12 492 C82 18 818 18 888 492" />
      {members.map((member, index) => {
        const { cx, cy } = seatPosition(index)
        const vote = mappedVotes.get(member.id) ?? 'no'
        const isSelected = selectedMemberId === member.id
        const className = [
          'seat',
          vote === 'yes' ? 'yes' : 'no',
          isSelected ? 'selected' : '',
          flippedIds.has(member.id) && mode === 'finalVote' ? 'flipped' : '',
          reveal ? 'reveal' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <circle
            key={member.id}
            className={className}
            cx={cx}
            cy={cy}
            r={9 + Math.min(member.persuasionScore, 2) * 2}
            fill={vote === 'yes' ? partyColor(member.party) : 'transparent'}
            stroke={partyColor(member.party)}
            strokeWidth={isSelected ? 4 : 2}
            style={{ '--seat-delay': `${index * 16}ms` } as CSSProperties}
            onClick={() => onSelect?.(member.id)}
            onMouseEnter={() => setHoveredSeat({ member, cx, cy })}
            onMouseLeave={() => setHoveredSeat(null)}
          >
            <title>{`${member.name}, ${member.state} ${partyName(member.party)} | ideology ${member.ideology.toFixed(2)} | ${vote.toUpperCase()}`}</title>
          </circle>
        )
      })}
      {hoveredSeat ? (
        <g className="seat-tooltip" transform={`translate(${Math.min(684, Math.max(18, hoveredSeat.cx - 98))} ${Math.max(18, hoveredSeat.cy - 86)})`}>
          <rect width="196" height="66" rx="12" />
          <text x="98" y="22" className="tooltip-name">
            {truncate(hoveredSeat.member.name, 23)}
          </text>
          <text x="98" y="39">
            {hoveredSeat.member.state} ·{' '}
            <tspan style={{ fill: partyColor(hoveredSeat.member.party) }}>{hoveredSeat.member.party}</tspan> ·{' '}
            {mappedVotes.get(hoveredSeat.member.id)?.toUpperCase() ?? 'NO'}
          </text>
          <text x="98" y="54">
            Ideology{' '}
            <tspan style={{ fill: partyColor(hoveredSeat.member.party) }}>
              {hoveredSeat.member.ideology.toFixed(2)}
            </tspan>{' '}
            · Persuasion{' '}
            <tspan className={hoveredSeat.member.persuasionScore < 0 ? 'tooltip-negative' : 'tooltip-persuasion'}>
              {signedScore(hoveredSeat.member.persuasionScore)}
            </tspan>
          </text>
        </g>
      ) : null}
    </svg>
  )
}

function ChamberLegend({ final = false }: { final?: boolean }) {
  return (
    <div className="chamber-legend" aria-label="Chamber legend">
      <span><i className="dot dem" /> Democrat</span>
      <span><i className="dot rep" /> Republican</span>
      <span><i className="dot ind" /> Independent</span>
      <span><i className="dot yes" /> Yes vote</span>
      <span><i className="dot no" /> No vote</span>
      {final ? <span><i className="dot flipped" /> Flipped seat</span> : null}
    </div>
  )
}

function SourceBadge() {
  const source = usePolygenStore((state) => state.source)
  return <div className={`source-badge ${source.mode}`}>{source.label}</div>
}

function PolicyCreation() {
  const policyText = usePolygenStore((state) => state.policyText)
  const setPolicyText = usePolygenStore((state) => state.setPolicyText)
  const refinePolicy = usePolygenStore((state) => state.refinePolicy)
  const isLoading = usePolygenStore((state) => state.isLoading)
  const error = usePolygenStore((state) => state.error)

  return (
    <main className="screen policy-screen">
      <SourceBadge />
      <section className="policy-card">
        <p className="eyebrow">PolyGen</p>
        <h1>Turn a policy instinct into a political fight.</h1>
        <textarea
          value={policyText}
          onChange={(event) => setPolicyText(event.target.value)}
          placeholder="Universal basic income funded by a wealth tax..."
        />
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" type="button" disabled={isLoading} onClick={refinePolicy}>
          {isLoading ? 'Generating...' : 'Generate Bill'}
        </button>
      </section>
    </main>
  )
}

function BillRefinement({ bill }: { bill: Bill }) {
  const updateBill = usePolygenStore((state) => state.updateBill)
  const confirmBill = usePolygenStore((state) => state.confirmBill)

  return (
    <main className="screen refine-screen">
      <SourceBadge />
      <section className="refine-grid">
        <article className="bill-preview">
          <p className="eyebrow">AI Draft</p>
          <h1>{bill.title}</h1>
          <p>{bill.summary}</p>
          <div className="lean-meter">
            <span>Left</span>
            <div>
              <i style={{ left: `${((bill.lean + 1) / 2) * 100}%` }} />
            </div>
            <span>Right</span>
          </div>
          <div className="readonly-lean preview-lean" aria-label={`Model inferred ideological lean ${bill.lean.toFixed(2)}`}>
            <div>
              <strong>Model-Inferred Lean</strong>
              <span>{bill.lean.toFixed(2)}</span>
            </div>
            <p>
              The model infers this from the proposal's language so vote behavior stays tied to the bill itself. To
              change it, revise the title, summary, or tags and regenerate the bill.
            </p>
          </div>
        </article>
        <article className="editor-panel">
          <label>
            Title
            <input value={bill.title} onChange={(event) => updateBill({ ...bill, title: event.target.value })} />
          </label>
          <label>
            Summary
            <textarea value={bill.summary} onChange={(event) => updateBill({ ...bill, summary: event.target.value })} />
          </label>
          <div className="chip-editor">
            <span className="field-title">Tags</span>
            <div className="readonly-chips">
              {bill.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="chip-editor">
            <span className="field-title">Affected Groups</span>
            <div className="readonly-chips groups">
              {bill.affectedGroups.map((group) => (
                <span key={group}>{group}</span>
              ))}
            </div>
          </div>
          <button className="primary confirm-bill" type="button" onClick={confirmBill}>
            Confirm Bill →
          </button>
        </article>
      </section>
    </main>
  )
}

function InitialVote({ bill }: { bill: Bill }) {
  const members = usePolygenStore((state) => state.members)
  const votes = usePolygenStore((state) => state.votes)
  const beginLobbying = usePolygenStore((state) => state.beginLobbying)

  return (
    <main className="screen chamber-screen initial-screen">
      <header className="vote-header">
        <div>
          <p className="eyebrow">Initial Vote</p>
          <h1>{bill.title}</h1>
        </div>
        <Tally votes={votes} mode="initialVote" />
      </header>
      <ChamberLegend />
      <Chamber members={members} votes={votes} mode="initialVote" reveal />
      <button className="primary floating" type="button" onClick={beginLobbying}>
        Begin Lobbying →
      </button>
    </main>
  )
}

function Avatar({ member }: { member: Politician }) {
  if (member.imageUrl) return <img className="avatar" src={member.imageUrl} alt="" />
  return (
    <div className="avatar initials" style={{ background: partyColor(member.party) }}>
      {initials(member.name)}
    </div>
  )
}

function MemberPanel({ member, bill }: { member: Politician; bill: Bill }) {
  const sendLobbyMessage = usePolygenStore((state) => state.sendLobbyMessage)
  const messages = usePolygenStore((state) => state.messages).filter((message) => message.politicianId === member.id)
  const initialPosition = usePolygenStore((state) =>
    state.votes.find((vote) => vote.politicianId === member.id)?.initialVote ?? 'no',
  )
  const isLoading = usePolygenStore((state) => state.isLoading)
  const [draft, setDraft] = useState('')
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const alignment = alignmentScore(member, bill)
  const primaryTrait = member.traits[0]
  const concern =
    alignment > 0.72
      ? 'I already see some alignment here, but party leadership and my base still matter.'
      : alignment > 0.48
        ? 'I am persuadable, but I need partisan cover plus specifics about who benefits.'
        : 'This cuts against my politics, so you will need a very concrete local case and a way to sell it to my side.'
  const openingMessage = `I am currently leaning ${initialPosition.toUpperCase()} on this. ${concern} ${partyPressure(member)}${
    primaryTrait ? ` My ${primaryTrait} instincts are going to shape how I hear your argument.` : ''
  }`

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await sendLobbyMessage(text)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [member.id, messages.length, isLoading])

  return (
    <aside className="member-panel">
      <div className="member-head">
        <Avatar member={member} />
        <div>
          <h2>{member.name}</h2>
          <p>{member.state} · {member.chamber === 'senate' ? 'Senate' : `House ${member.district ?? ''}`}</p>
          <span className="party-pill">{partyName(member.party)}</span>
        </div>
      </div>
      <p className="bio">{member.bio}</p>
      <div className="stat-row">
        <span>Ideology Alignment</span>
        <meter min="0" max="1" value={alignmentScore(member, bill)} />
      </div>
      <div className="stat-row">
        <span>Influence</span>
        <meter min="0" max="2" value={member.influence} />
      </div>
      <div className={`persuasion ${member.persuasionScore < 0 ? 'negative' : ''}`}>
        Persuasion {member.persuasionScore < 0 ? '▼' : '▲'} {signedScore(member.persuasionScore)}
      </div>
      <div className="chat-thread">
        <div className="bubble politician opener">
          <span>{openingMessage}</span>
        </div>
        {messages.length === 0 ? <p className="empty-chat">Make a targeted argument to move this member.</p> : null}
        {messages.map((message) => (
          <div key={message.id} className={`bubble ${message.author}`}>
            {message.persuasion !== undefined ? (
              <strong className={message.persuasion < 0 ? 'negative-score' : ''}>
                {signedScore(message.persuasion)} {message.persuasion < 0 ? '↓' : '↑'}
              </strong>
            ) : null}
            <span>{message.text}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form className="chat-form" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Persuade ${member.name.split(' ')[0]} with local stakes...`}
        />
        <button className="primary" type="submit" disabled={isLoading || !draft.trim()}>
          Send
        </button>
      </form>
    </aside>
  )
}

function Lobbying({ bill }: { bill: Bill }) {
  const members = usePolygenStore((state) => state.members)
  const votes = usePolygenStore((state) => state.votes)
  const selectedMemberId = usePolygenStore((state) => state.selectedMemberId)
  const selectMember = usePolygenStore((state) => state.selectMember)
  const callFinalVote = usePolygenStore((state) => state.callFinalVote)
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? members[0]

  return (
    <main className="lobby-screen">
      <header className="lobby-header">
        <div>
          <p className="eyebrow">Lobbying</p>
          <h1>{bill.title}</h1>
        </div>
        <button className="primary" type="button" onClick={callFinalVote}>
          Call Final Vote →
        </button>
      </header>
      <section className="lobby-grid">
        <div className="chamber-wrap">
          <Tally votes={votes} mode="initialVote" />
          <ChamberLegend />
          <Chamber
            members={members}
            votes={votes}
            mode="initialVote"
            selectedMemberId={selectedMember?.id}
            onSelect={selectMember}
          />
        </div>
        {selectedMember ? <MemberPanel member={selectedMember} bill={bill} /> : null}
      </section>
    </main>
  )
}

function FinalVote({ bill }: { bill: Bill }) {
  const members = usePolygenStore((state) => state.members)
  const votes = usePolygenStore((state) => state.votes)
  const reset = usePolygenStore((state) => state.reset)
  const initial = tally(votes, 'initialVote')
  const final = tally(votes, 'finalVote')
  const passed = final.yes > final.no

  return (
    <main className="screen chamber-screen final-screen">
      <header className="vote-header">
        <div>
          <p className="eyebrow">Final Vote</p>
          <h1>{bill.title}</h1>
        </div>
        <div className="before-after">
          <span>Before {initial.yes}-{initial.no}</span>
          <span>After {final.yes}-{final.no}</span>
        </div>
      </header>
      <div className={`result-banner ${passed ? 'passed' : 'failed'}`}>{passed ? 'Bill Passed' : 'Bill Failed'}</div>
      <ChamberLegend final />
      <Chamber members={members} votes={votes} mode="finalVote" reveal />
      <button className="primary floating" type="button" onClick={reset}>
        New Bill
      </button>
    </main>
  )
}

function App() {
  const initialize = usePolygenStore((state) => state.initialize)
  const phase = usePolygenStore((state) => state.phase)
  const bill = usePolygenStore((state) => state.bill)

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (phase === 'policy_creation') return <PolicyCreation />
  if (phase === 'policy_refinement' && bill) return <BillRefinement bill={bill} />
  if (phase === 'initial_vote' && bill) return <InitialVote bill={bill} />
  if (phase === 'lobbying' && bill) return <Lobbying bill={bill} />
  if (phase === 'final_vote' && bill) return <FinalVote bill={bill} />
  return <PolicyCreation />
}

export default App

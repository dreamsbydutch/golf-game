import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import './App.css'

const course = {
	name: 'Home Course',
	holes: [
		{ hole: 1, par: 4, strokeIndex: 5 },
		{ hole: 2, par: 3, strokeIndex: 15 },
		{ hole: 3, par: 4, strokeIndex: 17 },
		{ hole: 4, par: 4, strokeIndex: 1 },
		{ hole: 5, par: 4, strokeIndex: 9 },
		{ hole: 6, par: 5, strokeIndex: 11 },
		{ hole: 7, par: 4, strokeIndex: 13 },
		{ hole: 8, par: 4, strokeIndex: 3 },
		{ hole: 9, par: 3, strokeIndex: 7 },
		{ hole: 10, par: 4, strokeIndex: 10 },
		{ hole: 11, par: 3, strokeIndex: 18 },
		{ hole: 12, par: 4, strokeIndex: 6 },
		{ hole: 13, par: 4, strokeIndex: 2 },
		{ hole: 14, par: 4, strokeIndex: 14 },
		{ hole: 15, par: 4, strokeIndex: 16 },
		{ hole: 16, par: 5, strokeIndex: 4 },
		{ hole: 17, par: 3, strokeIndex: 12 },
		{ hole: 18, par: 4, strokeIndex: 8 },
	],
	teeSets: {
		white: {
			name: 'White Tees',
			rating: '67.8',
			slope: '126',
			yardsByHole: [374, 159, 295, 350, 349, 478, 320, 340, 194, 385, 131, 358, 385, 312, 286, 442, 179, 415],
		},
		blue: {
			name: 'Blue Tees',
			rating: '70.5',
			slope: '129',
			yardsByHole: [395, 189, 337, 388, 372, 533, 336, 360, 219, 401, 138, 374, 406, 331, 295, 459, 204, 426],
		},
	},
}

const totalPar = course.holes.reduce((total, currentHole) => total + currentHole.par, 0)
const playerDefaults = [
	{ id: 1, name: 'Curtis', tee: 'blue', handicap: '12' },
	{ id: 2, name: 'Andrew', tee: 'white', handicap: '14' },
	{ id: 3, name: 'Mike', tee: 'blue', handicap: '8' },
	{ id: 4, name: 'Chris', tee: 'white', handicap: '18' },
]
const stablefordDefaults = {
	doubleBogeyOrWorse: 0,
	bogey: 1,
	par: 2,
	birdie: 4,
	eagleOrBetter: 6,
	lowestNetOnHole: 0,
	highestNetOnHole: 0,
}
const teams = [
	{ id: 'team-1', name: 'Team 1', playerIds: [1, 2] },
	{ id: 'team-2', name: 'Team 2', playerIds: [3, 4] },
]

function createDefaultConfig() {
	return {
		teams,
		players: playerDefaults,
		stableford: stablefordDefaults,
	}
}

function getViewFromHash() {
	if (typeof window === 'undefined') {
		return 'score'
	}

	return window.location.hash === '#/admin' ? 'admin' : 'score'
}

function isEnteredScore(value) {
	const score = Number(value)
	return Number.isFinite(score) && score > 0
}

function getTeeSet(teeKey) {
	return course.teeSets[teeKey] ?? course.teeSets.white
}

function getHandicapStrokes(handicap, strokeIndex) {
	if (!Number.isFinite(handicap) || handicap <= 0) {
		return 0
	}

	const fullRounds = Math.floor(handicap / 18)
	const extraStrokes = handicap % 18
	return fullRounds + (extraStrokes > 0 && strokeIndex <= extraStrokes ? 1 : 0)
}

function getStablefordPoints(score, par, handicapStrokes, stablefordSettings) {
	if (!Number.isFinite(score) || score <= 0) {
		return 0
	}

	const netScore = score - handicapStrokes
	const scoreToPar = netScore - par

	if (scoreToPar <= -2) {
		return Number(stablefordSettings.eagleOrBetter)
	}

	if (scoreToPar === -1) {
		return Number(stablefordSettings.birdie)
	}

	if (scoreToPar === 0) {
		return Number(stablefordSettings.par)
	}

	if (scoreToPar === 1) {
		return Number(stablefordSettings.bogey)
	}

	return Number(stablefordSettings.doubleBogeyOrWorse)
}

function getPlayerNetScore(player, holeIndex) {
	const currentHole = course.holes[holeIndex]
	const score = Number(player.scores[holeIndex])
	if (!Number.isFinite(score) || score <= 0) {
		return null
	}

	const handicapStrokes = getHandicapStrokes(Number(player.handicap), currentHole.strokeIndex)
	return score - handicapStrokes
}

function getHoleBonusPoints(players, playerId, holeIndex, stablefordSettings) {
	const scoredPlayers = players
		.map(player => ({
			id: player.id,
			netScore: getPlayerNetScore(player, holeIndex),
		}))
		.filter(player => player.netScore !== null)

	if (scoredPlayers.length === 0) {
		return 0
	}

	const currentPlayer = scoredPlayers.find(player => player.id === playerId)
	if (!currentPlayer) {
		return 0
	}

	const lowestNetScore = Math.min(...scoredPlayers.map(player => player.netScore))
	const highestNetScore = Math.max(...scoredPlayers.map(player => player.netScore))
	const lowestNetPlayers = scoredPlayers.filter(player => player.netScore === lowestNetScore)
	const highestNetPlayers = scoredPlayers.filter(player => player.netScore === highestNetScore)
	let bonusPoints = 0

	if (currentPlayer.netScore === lowestNetScore) {
		bonusPoints += Number(stablefordSettings.lowestNetOnHole) / lowestNetPlayers.length
	}

	if (currentPlayer.netScore === highestNetScore) {
		bonusPoints += Number(stablefordSettings.highestNetOnHole) / highestNetPlayers.length
	}

	return bonusPoints
}

function formatPoints(points) {
	return Number.isInteger(points) ? points.toString() : points.toFixed(2).replace(/\.?0+$/, '')
}

function getPlayerHoleSummary(player, holeIndex, stablefordSettings, allPlayers) {
	const currentHole = course.holes[holeIndex]
	const teeSet = getTeeSet(player.tee)
	const score = Number(player.scores[holeIndex])
	const handicapStrokes = getHandicapStrokes(Number(player.handicap), currentHole.strokeIndex)
	const basePoints = getStablefordPoints(score, currentHole.par, handicapStrokes, stablefordSettings)
	const bonusPoints = getHoleBonusPoints(allPlayers, player.id, holeIndex, stablefordSettings)
	const points = basePoints + bonusPoints

	return {
		score,
		points,
		basePoints,
		bonusPoints,
		handicapStrokes,
		yards: teeSet.yardsByHole[holeIndex],
		teeName: teeSet.name,
		hasScore: isEnteredScore(player.scores[holeIndex]),
	}
}

function getPlayerStablefordTotal(player, players, stablefordSettings) {
	return player.scores.reduce((total, rawScore, index) => {
		const summary = getPlayerHoleSummary(player, index, stablefordSettings, players)
		return summary.hasScore ? total + summary.points : total
	}, 0)
}

function getPlayerRoundScoreSummary(player) {
	return player.scores.reduce(
		(totals, rawScore, index) => {
			const score = Number(rawScore)
			if (!Number.isFinite(score) || score <= 0) {
				return totals
			}

			const handicapStrokes = getHandicapStrokes(Number(player.handicap), course.holes[index].strokeIndex)
			totals.totalScore += score
			totals.grossToPar += score - course.holes[index].par
			totals.netToPar += score - handicapStrokes - course.holes[index].par
			return totals
		},
		{ totalScore: 0, grossToPar: 0, netToPar: 0 },
	)
}

function formatToPar(value, hasScores) {
	if (!hasScores) {
		return 'E'
	}

	if (value > 0) {
		return `+${value}`
	}

	if (value === 0) {
		return 'E'
	}

	return `${value}`
}

function getTeamStablefordTotal(players, team, stablefordSettings) {
	return team.playerIds.reduce((total, playerId) => {
		const player = players.find(currentPlayer => currentPlayer.id === playerId)
		return player ? total + getPlayerStablefordTotal(player, players, stablefordSettings) : total
	}, 0)
}

function getTeamClassNameForPlayer(playerId) {
	return playerId <= 2 ? 'team-one' : 'team-two'
}

function App() {
	const gameState = useQuery(api.gameState.get)
	const initializeGameState = useMutation(api.gameState.initialize)
	const updateScoreMutation = useMutation(api.gameState.updateScore)
	const setCurrentHoleIndexMutation = useMutation(api.gameState.setCurrentHoleIndex)
	const saveAdminSettingsMutation = useMutation(api.gameState.saveAdminSettings)
	const [adminDraft, setAdminDraft] = useState(createDefaultConfig)
	const [autoAdvanceHoleIndex, setAutoAdvanceHoleIndex] = useState(null)
	const [view, setView] = useState(getViewFromHash)
	const [showConnectionHelp, setShowConnectionHelp] = useState(false)

	useEffect(() => {
		const handleHashChange = () => {
			setView(getViewFromHash())
		}

		window.addEventListener('hashchange', handleHashChange)
		return () => window.removeEventListener('hashchange', handleHashChange)
	}, [])

	useEffect(() => {
		if (gameState && !('_id' in gameState)) {
			void initializeGameState({})
		}
	}, [gameState, initializeGameState])

	useEffect(() => {
		if (gameState !== undefined) {
			setShowConnectionHelp(false)
			return
		}

		const timer = window.setTimeout(() => {
			setShowConnectionHelp(true)
		}, 4000)

		return () => window.clearTimeout(timer)
	}, [gameState])

	useEffect(() => {
		if (gameState) {
			setAdminDraft({
				teams: gameState.teams,
				players: gameState.players.map(player => ({
					id: player.id,
					name: player.name,
					tee: player.tee,
					handicap: player.handicap,
				})),
				stableford: gameState.stableford,
			})
		}
	}, [gameState])

	const config = gameState
		? {
				teams: gameState.teams,
				stableford: gameState.stableford,
			}
		: createDefaultConfig()
	const players = gameState?.players ?? []
	const currentHoleIndex = gameState?.currentHoleIndex ?? 0

	useEffect(() => {
		if (gameState === undefined || gameState === null) {
			return
		}

		if (autoAdvanceHoleIndex !== currentHoleIndex) {
			return
		}

		const holeIsComplete = players.every(player => isEnteredScore(player.scores[currentHoleIndex]))
		if (!holeIsComplete || currentHoleIndex === course.holes.length - 1) {
			return
		}

		const nextIncompleteHoleIndex = course.holes.findIndex(
			(currentHole, index) => index > currentHoleIndex && players.some(player => !isEnteredScore(player.scores[index])),
		)

		if (nextIncompleteHoleIndex !== -1) {
			setAutoAdvanceHoleIndex(null)
			void setCurrentHoleIndexMutation({ currentHoleIndex: nextIncompleteHoleIndex })
		}
	}, [autoAdvanceHoleIndex, currentHoleIndex, gameState, players, setCurrentHoleIndexMutation])

	if (gameState === undefined) {
		return (
			<main className="app-shell">
				<section className="teams-panel admin-panel">
					<div className="section-copy">
						<h2>{showConnectionHelp ? 'Convex Connection Problem' : 'Loading'}</h2>
						{showConnectionHelp ? (
							<>
								<p>The app is not receiving a response from Convex.</p>
								<p>Configured URL: {import.meta.env.VITE_CONVEX_URL || 'Missing VITE_CONVEX_URL'}</p>
								<p>Check that Vercel is using the latest deployment and that this URL matches your production Convex deployment.</p>
							</>
						) : (
							<p>Connecting to shared game state.</p>
						)}
					</div>
				</section>
			</main>
		)
	}

	const updatePlayerScore = (playerId, holeIndex, value) => {
		const parsedValue = Number(value)
		const sanitizedValue = value === '' || !Number.isFinite(parsedValue) ? '' : Math.max(1, Math.floor(parsedValue))
		const previousScore = players.find(player => player.id === playerId)?.scores[holeIndex]
		const shouldAutoAdvance = holeIndex === currentHoleIndex && !isEnteredScore(previousScore) && sanitizedValue !== ''

		void updateScoreMutation({
			playerId,
			holeIndex,
			score: sanitizedValue === '' ? '' : String(sanitizedValue),
		})

		if (shouldAutoAdvance) {
			setAutoAdvanceHoleIndex(holeIndex)
		}
	}

	const currentHole = course.holes[currentHoleIndex]
	const currentHoleComplete = players.every(player => isEnteredScore(player.scores[currentHoleIndex]))
	const completedHoleCount = course.holes.filter((currentCourseHole, index) => players.every(player => isEnteredScore(player.scores[index]))).length

	const saveAdminSettings = () => {
		const sanitizedTeams = adminDraft.teams.map(team => ({
			id: team.id,
			...team,
			name: team.name.trim() || (team.id === 'team-1' ? 'Team 1' : 'Team 2'),
		}))
		const sanitizedPlayers = adminDraft.players.map(player => ({
			id: player.id,
			name: player.name,
			tee: player.tee === 'blue' ? 'blue' : 'white',
			handicap: String(Math.max(0, Math.floor(Number(player.handicap) || 0))),
		}))
		const sanitizedStableford = Object.fromEntries(Object.entries(adminDraft.stableford).map(([key, value]) => [key, Number(value) || 0]))

		void saveAdminSettingsMutation({
			teams: sanitizedTeams,
			players: sanitizedPlayers,
			stableford: sanitizedStableford,
		}).then(() => {
			window.location.hash = '#/'
		})
	}

	if (view === 'admin') {
		return (
			<main className="app-shell admin-shell">
				<section className="teams-panel admin-panel">
					<div className="section-copy">
						<h2>Admin</h2>
						<p>Update player details and Stableford points.</p>
					</div>
					<div className="admin-section">
						<h3>Teams</h3>
						<div className="admin-grid compact-grid">
							{adminDraft.teams.map(team => (
								<label key={team.id} className="admin-field admin-card">
									<span>{team.id === 'team-1' ? 'Team 1 name' : 'Team 2 name'}</span>
									<input
										type="text"
										value={team.name}
										onChange={event =>
											setAdminDraft(currentDraft => ({
												...currentDraft,
												teams: currentDraft.teams.map(currentTeam =>
													currentTeam.id === team.id ? { ...currentTeam, name: event.target.value } : currentTeam,
												),
											}))
										}
									/>
								</label>
							))}
						</div>
					</div>
					<div className="admin-section">
						<h3>Players</h3>
						<div className="admin-grid">
							{adminDraft.players.map(player => (
								<article key={player.id} className="admin-card">
									<strong>{player.id <= 2 ? 'Team 1' : 'Team 2'}</strong>
									<label className="admin-field">
										<span>Name</span>
										<input
											type="text"
											value={player.name}
											onChange={event =>
												setAdminDraft(currentDraft => ({
													...currentDraft,
													players: currentDraft.players.map(currentPlayer =>
														currentPlayer.id === player.id ? { ...currentPlayer, name: event.target.value } : currentPlayer,
													),
												}))
											}
										/>
									</label>
									<label className="admin-field">
										<span>Handicap</span>
										<input
											type="number"
											min="0"
											value={player.handicap}
											onChange={event =>
												setAdminDraft(currentDraft => ({
													...currentDraft,
													players: currentDraft.players.map(currentPlayer =>
														currentPlayer.id === player.id ? { ...currentPlayer, handicap: event.target.value } : currentPlayer,
													),
												}))
											}
										/>
									</label>
									<label className="admin-field">
										<span>Tee</span>
										<select
											value={player.tee}
											onChange={event =>
												setAdminDraft(currentDraft => ({
													...currentDraft,
													players: currentDraft.players.map(currentPlayer =>
														currentPlayer.id === player.id ? { ...currentPlayer, tee: event.target.value } : currentPlayer,
													),
												}))
											}>
											<option value="blue">Blue</option>
											<option value="white">White</option>
										</select>
									</label>
								</article>
							))}
						</div>
					</div>
					<div className="admin-section">
						<h3>Stableford</h3>
						<div className="admin-grid compact-grid">
							{[
								['eagleOrBetter', 'Eagle or better'],
								['birdie', 'Birdie'],
								['par', 'Par'],
								['bogey', 'Bogey'],
								['doubleBogeyOrWorse', 'Double bogey or worse'],
								['lowestNetOnHole', 'Lowest net on hole'],
								['highestNetOnHole', 'Highest net on hole'],
							].map(([key, label]) => (
								<label key={key} className="admin-field admin-card">
									<span>{label}</span>
									<input
										type="number"
										value={adminDraft.stableford[key]}
										onChange={event =>
											setAdminDraft(currentDraft => ({
												...currentDraft,
												stableford: {
													...currentDraft.stableford,
													[key]: event.target.value,
												},
											}))
										}
									/>
								</label>
							))}
						</div>
					</div>
					<div className="admin-actions">
						<a className="ghost-button admin-link" href="#/">
							Back to scores
						</a>
						<button type="button" className="ghost-button admin-save-button" onClick={saveAdminSettings}>
							Save settings
						</button>
					</div>
				</section>
			</main>
		)
	}

	return (
		<main className="app-shell">
			<section className="teams-panel">
				<div className="team-score-list">
					{config.teams.map(team => (
						<article key={team.id} className={`team-card ${team.id === 'team-1' ? 'team-one' : 'team-two'}`}>
							<p className="team-label">{team.name}</p>
							<p className="team-name">{team.name}</p>
							<p className="team-players">
								{team.playerIds
									.map(playerId => players.find(player => player.id === playerId)?.name)
									.filter(Boolean)
									.join(' + ')}
							</p>
							<div className="team-points">
								<strong>{formatPoints(getTeamStablefordTotal(players, team, config.stableford))}</strong>
								<span>Total</span>
							</div>
						</article>
					))}
				</div>
			</section>

			<section className="hole-panel">
				<details className="hole-details">
					<summary>
						<span className="hole-number-display">Hole {currentHole.hole}</span>
						<span>
							Par {currentHole.par} • Hcp {currentHole.strokeIndex} • Blue {course.teeSets.blue.yardsByHole[currentHoleIndex]} • White{' '}
							{course.teeSets.white.yardsByHole[currentHoleIndex]}
						</span>
					</summary>
					<div className="hole-header">
						<div>
							<span className="stat-label">Par</span>
							<strong>{currentHole.par}</strong>
						</div>
						<div>
							<span className="stat-label">Handicap</span>
							<strong>{currentHole.strokeIndex}</strong>
						</div>
						<div>
							<span className="stat-label">Blue</span>
							<strong>{course.teeSets.blue.yardsByHole[currentHoleIndex]} yds</strong>
						</div>
						<div>
							<span className="stat-label">White</span>
							<strong>{course.teeSets.white.yardsByHole[currentHoleIndex]} yds</strong>
						</div>
					</div>
				</details>
				<div className="hole-entry-list">
					{players.map(player => {
						const summary = getPlayerHoleSummary(player, currentHoleIndex, config.stableford, players)
						const roundScoreSummary = getPlayerRoundScoreSummary(player)
						const hasRoundScores = roundScoreSummary.totalScore > 0
						const strokeLabel =
							summary.handicapStrokes > 0 ? `${summary.handicapStrokes} stroke${summary.handicapStrokes > 1 ? 's' : ''}` : 'No strokes'
						const grossToParLabel = formatToPar(roundScoreSummary.grossToPar, hasRoundScores)
						const netToParLabel = formatToPar(roundScoreSummary.netToPar, hasRoundScores)
						const pointLabel = summary.bonusPoints !== 0 ? `Points ${summary.bonusPoints > 0 ? '+' : ''}${summary.bonusPoints}` : 'Points'

						return (
							<article key={player.id} className={`score-entry-card ${getTeamClassNameForPlayer(player.id)}`}>
								<div className="score-entry-copy">
									<div className="player-row-top">
										<div className="player-name-row">
											<span className={`tee-marker tee-${player.tee}`} aria-hidden="true"></span>
											<p className="team-name">{player.name}</p>
											<div className="player-to-par-group">
												<p className="player-to-par-display">{grossToParLabel}</p>
												<p className="player-to-par-divider">/</p>
												<p className="player-to-par-label">NET</p>
												<p className="player-to-par-display">{netToParLabel}</p>
											</div>
										</div>
										<span className="stroke-chip">{strokeLabel}</span>
									</div>
								</div>
								<div className="score-entry-inputs">
									<label className="score-field">
										<span>Gross</span>
										<input
											className="score-input"
											type="number"
											min="1"
											inputMode="numeric"
											value={player.scores[currentHoleIndex]}
											onChange={event => updatePlayerScore(player.id, currentHoleIndex, event.target.value)}
											aria-label={`${player.name} score on hole ${currentHole.hole}`}
										/>
									</label>
									<div className="player-points-pill">
										<strong>{summary.hasScore ? formatPoints(summary.points) : '-'}</strong>
										<span>{pointLabel}</span>
									</div>
								</div>
							</article>
						)
					})}
				</div>
				<div className="hole-actions">
					<button
						type="button"
						className="ghost-button"
						onClick={() => {
							setAutoAdvanceHoleIndex(null)
							void setCurrentHoleIndexMutation({ currentHoleIndex: Math.max(0, currentHoleIndex - 1) })
						}}
						disabled={currentHoleIndex === 0}>
						Back
					</button>
					<button
						type="button"
						className="ghost-button"
						onClick={() => {
							setAutoAdvanceHoleIndex(null)
							void setCurrentHoleIndexMutation({
								currentHoleIndex: Math.min(course.holes.length - 1, currentHoleIndex + 1),
							})
						}}
						disabled={currentHoleIndex === course.holes.length - 1}>
						Next
					</button>
				</div>
				<div className="app-footer-link-row">
					<a className="ghost-button admin-link" href="#/admin">
						Admin
					</a>
				</div>
			</section>
		</main>
	)
}

export default App

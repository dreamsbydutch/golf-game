import { useEffect, useMemo, useRef, useState } from 'react'
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

const playerDefaults = [
	{ id: 1, name: 'Curtis', tee: 'blue' },
	{ id: 2, name: 'Andrew', tee: 'white' },
	{ id: 3, name: 'Mike', tee: 'blue' },
	{ id: 4, name: 'Chris', tee: 'white' },
]

const stablefordDefaults = {
	doubleBogeyOrWorse: 0,
	bogey: 1,
	par: 2,
	birdie: 4,
	eagleOrBetter: 6,
	bonusShot: 2,
	mulligan: -1,
}

const teamDefaults = [
	{
		id: 'team-1',
		name: 'Team 1',
		playerIds: [1, 2],
		badGolferId: 2,
		scores: Array(18).fill(''),
		bonusShotCounts: Array(18).fill(0),
		mulliganCounts: Array(18).fill(0),
	},
	{
		id: 'team-2',
		name: 'Team 2',
		playerIds: [3, 4],
		badGolferId: 4,
		scores: Array(18).fill(''),
		bonusShotCounts: Array(18).fill(0),
		mulliganCounts: Array(18).fill(0),
	},
]

function createEmptyScores() {
	return Array(18).fill('')
}

function createEmptyCounts() {
	return Array(18).fill(0)
}

function normalizeCountArray(values) {
	if (!Array.isArray(values)) {
		return createEmptyCounts()
	}

	return Array.from({ length: 18 }, (_, index) => Math.max(0, Math.floor(Number(values[index]) || 0)))
}

function normalizeScoreArray(values) {
	if (!Array.isArray(values)) {
		return createEmptyScores()
	}

	return Array.from({ length: 18 }, (_, index) => values[index] ?? '')
}

function normalizeTeamForView(team) {
	const teamDefault = teamDefaults.find(defaultTeam => defaultTeam.id === team?.id) ?? teamDefaults[0]

	return {
		...teamDefault,
		...team,
		playerIds: Array.isArray(team?.playerIds) ? team.playerIds : teamDefault.playerIds,
		scores: normalizeScoreArray(team?.scores),
		bonusShotCounts: normalizeCountArray(team?.bonusShotCounts),
		mulliganCounts: normalizeCountArray(team?.mulliganCounts),
	}
}

function normalizeTeamsForView(teams) {
	return (Array.isArray(teams) ? teams : teamDefaults).map(normalizeTeamForView)
}

function createDefaultConfig() {
	return {
		teams: normalizeTeamsForView(teamDefaults),
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

function getStablefordPoints(score, par, stablefordSettings) {
	if (!Number.isFinite(score) || score <= 0) {
		return 0
	}

	const scoreToPar = score - par

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

function formatPoints(points) {
	return Number.isInteger(points) ? points.toString() : points.toFixed(2).replace(/\.?0+$/, '')
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

function getTeamClassName(teamId) {
	return teamId === 'team-1' ? 'team-one' : 'team-two'
}

function getTeamPlayers(team, players) {
	return team.playerIds.map(playerId => players.find(player => player.id === playerId)).filter(Boolean)
}

function getBadGolfer(team, players) {
	return players.find(player => player.id === team.badGolferId) ?? getTeamPlayers(team, players)[0] ?? null
}

function getTeamById(teams, teamId) {
	return teams.find(team => team.id === teamId) ?? null
}

function getTeamHoleSummary(team, holeIndex, stablefordSettings) {
	const normalizedTeam = normalizeTeamForView(team)
	const currentHole = course.holes[holeIndex]
	const score = Number(normalizedTeam.scores[holeIndex])
	const basePoints = getStablefordPoints(score, currentHole.par, stablefordSettings)
	const bonusShotCount = Math.max(0, Math.floor(Number(normalizedTeam.bonusShotCounts[holeIndex]) || 0))
	const mulliganCount = Math.max(0, Math.floor(Number(normalizedTeam.mulliganCounts[holeIndex]) || 0))
	const bonusPoints = bonusShotCount * Number(stablefordSettings.bonusShot ?? stablefordDefaults.bonusShot)
	const mulliganPoints = mulliganCount * Number(stablefordSettings.mulligan ?? stablefordDefaults.mulligan)
	const points = basePoints + bonusPoints + mulliganPoints

	return {
		score,
		points,
		bonusShotCount,
		mulliganCount,
		bonusPoints,
		mulliganPoints,
		hasScore: isEnteredScore(normalizedTeam.scores[holeIndex]),
	}
}

function getTeamStablefordTotal(team, stablefordSettings) {
	const normalizedTeam = normalizeTeamForView(team)
	return normalizedTeam.scores.reduce((total, rawScore, index) => {
		const summary = getTeamHoleSummary(team, index, stablefordSettings)
		return summary.hasScore ? total + summary.points : total
	}, 0)
}

function getTeamRoundScoreSummary(team) {
	return team.scores.reduce(
		(totals, rawScore, index) => {
			const score = Number(rawScore)
			if (!Number.isFinite(score) || score <= 0) {
				return totals
			}

			totals.totalScore += score
			totals.grossToPar += score - course.holes[index].par
			return totals
		},
		{ totalScore: 0, grossToPar: 0 },
	)
}

function getHoleYardageSummary(team, players, holeIndex) {
	return getTeamPlayers(team, players)
		.map(player => `${player.name}: ${course.teeSets[player.tee]?.yardsByHole[holeIndex] ?? course.teeSets.white.yardsByHole[holeIndex]} yds`)
		.join(' • ')
}

function createHoleDrafts(teams, holeIndex) {
	return Object.fromEntries(
		normalizeTeamsForView(teams).map(team => [
			team.id,
			{
				score: team.scores[holeIndex] ?? '',
				bonusShotCount: String(Math.max(0, Math.floor(Number(team.bonusShotCounts?.[holeIndex]) || 0))),
				mulliganCount: String(Math.max(0, Math.floor(Number(team.mulliganCounts?.[holeIndex]) || 0))),
			},
		]),
	)
}

function applyHoleDraftsToTeams(teams, holeDrafts, holeIndex) {
	return normalizeTeamsForView(teams).map(team => {
		const teamDraft = holeDrafts[team.id]
		if (!teamDraft) {
			return team
		}

		const nextScores = [...team.scores]
		nextScores[holeIndex] = teamDraft.score
		const nextBonusShotCounts = [...team.bonusShotCounts]
		nextBonusShotCounts[holeIndex] = Math.max(0, Math.floor(Number(teamDraft.bonusShotCount) || 0))
		const nextMulliganCounts = [...team.mulliganCounts]
		nextMulliganCounts[holeIndex] = Math.max(0, Math.floor(Number(teamDraft.mulliganCount) || 0))

		return {
			...team,
			scores: nextScores,
			bonusShotCounts: nextBonusShotCounts,
			mulliganCounts: nextMulliganCounts,
		}
	})
}

function mergeTeams(preferredTeams, incomingTeams) {
	return normalizeTeamsForView(incomingTeams).map(incomingTeam => {
		const preferredTeam = normalizeTeamsForView(preferredTeams).find(team => team.id === incomingTeam.id)
		if (!preferredTeam) {
			return incomingTeam
		}

		return {
			...incomingTeam,
			scores: incomingTeam.scores.map((score, index) => score || preferredTeam.scores[index] || ''),
			bonusShotCounts: incomingTeam.bonusShotCounts.map((count, index) => {
				const normalizedCount = Math.max(0, Math.floor(Number(count) || 0))
				return normalizedCount !== 0 ? normalizedCount : (preferredTeam.bonusShotCounts[index] ?? 0)
			}),
			mulliganCounts: incomingTeam.mulliganCounts.map((count, index) => {
				const normalizedCount = Math.max(0, Math.floor(Number(count) || 0))
				return normalizedCount !== 0 ? normalizedCount : (preferredTeam.mulliganCounts[index] ?? 0)
			}),
		}
	})
}

function mergeGameStates(preferredState, incomingState) {
	if (!preferredState) {
		return incomingState
	}

	return {
		...incomingState,
		teams: mergeTeams(preferredState.teams, incomingState.teams),
	}
}

function App() {
	const gameState = useQuery(api.gameState.get)
	const initializeGameState = useMutation(api.gameState.initialize)
	const updateTeamHoleMutation = useMutation(api.gameState.updateTeamHole)
	const setCurrentHoleIndexMutation = useMutation(api.gameState.setCurrentHoleIndex)
	const saveAdminSettingsMutation = useMutation(api.gameState.saveAdminSettings)
	const [adminDraft, setAdminDraft] = useState(createDefaultConfig)
	const [view, setView] = useState(getViewFromHash)
	const [showConnectionHelp, setShowConnectionHelp] = useState(false)
	const [lastLoadedGameState, setLastLoadedGameState] = useState(null)
	const [holeDrafts, setHoleDrafts] = useState({})
	const [optimisticGameState, setOptimisticGameState] = useState(null)
	const [displayHoleIndex, setDisplayHoleIndex] = useState(0)
	const optimisticGameStateRef = useRef(null)

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
		optimisticGameStateRef.current = optimisticGameState
	}, [optimisticGameState])

	useEffect(() => {
		if (gameState?._id) {
			setLastLoadedGameState(currentState => mergeGameStates(optimisticGameStateRef.current ?? currentState, gameState))
			setOptimisticGameState(null)
		}
	}, [gameState])

	useEffect(() => {
		if (gameState) {
			setAdminDraft({
				teams: gameState.teams.map(team => ({
					id: team.id,
					name: team.name,
					playerIds: team.playerIds,
					badGolferId: team.badGolferId,
				})),
				players: gameState.players.map(player => ({
					id: player.id,
					name: player.name,
					tee: player.tee,
				})),
				stableford: gameState.stableford,
			})
		}
	}, [gameState])

	const activeGameState = optimisticGameState ?? lastLoadedGameState ?? (gameState?._id ? gameState : null)

	const teams = useMemo(() => normalizeTeamsForView(activeGameState?.teams ?? teamDefaults), [activeGameState?.teams])
	const stablefordSettings = activeGameState?.stableford ?? stablefordDefaults
	const players = activeGameState?.players ?? playerDefaults
	const currentHoleIndex = activeGameState?.currentHoleIndex ?? 0
	const displayedTeams = applyHoleDraftsToTeams(teams, holeDrafts, displayHoleIndex)

	useEffect(() => {
		if (!optimisticGameState) {
			setDisplayHoleIndex(currentHoleIndex)
		}
	}, [currentHoleIndex, optimisticGameState])

	useEffect(() => {
		setHoleDrafts(createHoleDrafts(teams, displayHoleIndex))
	}, [displayHoleIndex, teams])

	if (gameState === undefined && activeGameState === null) {
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

	const getDraftForTeam = teamId =>
		holeDrafts[teamId] ?? {
			score: '',
			bonusShotCount: '0',
			mulliganCount: '0',
		}

	const updateTeamScore = (teamId, holeIndex, value) => {
		const parsedValue = Number(value)
		const sanitizedValue = value === '' || !Number.isFinite(parsedValue) ? '' : Math.max(1, Math.floor(parsedValue))

		setHoleDrafts(currentDrafts => ({
			...currentDrafts,
			[teamId]: {
				...getDraftForTeam(teamId),
				score: sanitizedValue === '' ? '' : String(sanitizedValue),
			},
		}))
	}

	const updateTeamBonusShotCount = (teamId, holeIndex, value) => {
		const parsedValue = Number(value)
		const sanitizedValue = value === '' || !Number.isFinite(parsedValue) ? 0 : Math.max(0, Math.floor(parsedValue))

		setHoleDrafts(currentDrafts => ({
			...currentDrafts,
			[teamId]: {
				...getDraftForTeam(teamId),
				bonusShotCount: String(sanitizedValue),
			},
		}))
	}

	const updateTeamMulliganCount = (teamId, holeIndex, value) => {
		const parsedValue = Number(value)
		const sanitizedValue = value === '' || !Number.isFinite(parsedValue) ? 0 : Math.max(0, Math.floor(parsedValue))

		setHoleDrafts(currentDrafts => ({
			...currentDrafts,
			[teamId]: {
				...getDraftForTeam(teamId),
				mulliganCount: String(sanitizedValue),
			},
		}))
	}

	const navigateToHole = async nextHoleIndex => {
		const committedTeams = applyHoleDraftsToTeams(teams, holeDrafts, displayHoleIndex)

		setOptimisticGameState(currentState => {
			if (!activeGameState) {
				return currentState
			}

			return {
				...activeGameState,
				teams: committedTeams,
				currentHoleIndex: nextHoleIndex,
			}
		})
		setDisplayHoleIndex(nextHoleIndex)
		setHoleDrafts(createHoleDrafts(committedTeams, nextHoleIndex))

		await Promise.all(
			committedTeams.map(team =>
				updateTeamHoleMutation({
					teamId: team.id,
					holeIndex: displayHoleIndex,
					score: team.scores[displayHoleIndex] ?? '',
					bonusShotCount: team.bonusShotCounts[displayHoleIndex] ?? 0,
					mulliganCount: team.mulliganCounts[displayHoleIndex] ?? 0,
				}),
			),
		)

		await setCurrentHoleIndexMutation({ currentHoleIndex: nextHoleIndex })
	}

	const currentHole = course.holes[displayHoleIndex]
	const currentHoleComplete = displayedTeams.every(team => isEnteredScore(team.scores[displayHoleIndex]))
	const completedHoleCount = course.holes.filter((currentCourseHole, index) => teams.every(team => isEnteredScore(team.scores[index]))).length

	const saveAdminSettings = () => {
		const sanitizedTeams = adminDraft.teams.map(team => {
			const validPlayerIds = team.playerIds.filter(playerId => adminDraft.players.some(player => player.id === playerId))
			const fallbackBadGolferId = validPlayerIds[0] ?? team.badGolferId

			return {
				id: team.id,
				playerIds: validPlayerIds,
				name: team.name.trim() || (team.id === 'team-1' ? 'Team 1' : 'Team 2'),
				badGolferId: validPlayerIds.includes(team.badGolferId) ? team.badGolferId : fallbackBadGolferId,
			}
		})
		const sanitizedPlayers = adminDraft.players.map(player => ({
			id: player.id,
			name: player.name.trim() || `Player ${player.id}`,
			tee: player.tee === 'blue' ? 'blue' : 'white',
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
						<p>Update team names, designate the bonus golfer on each side, and tune Stableford points.</p>
					</div>
					<div className="admin-section">
						<h3>Teams</h3>
						<div className="admin-grid compact-grid">
							{adminDraft.teams.map(team => {
								const teamPlayers = getTeamPlayers(team, adminDraft.players)

								return (
									<article key={team.id} className="admin-card">
										<label className="admin-field">
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
										<label className="admin-field">
											<span>Bonus golfer</span>
											<select
												value={team.badGolferId}
												onChange={event =>
													setAdminDraft(currentDraft => ({
														...currentDraft,
														teams: currentDraft.teams.map(currentTeam =>
															currentTeam.id === team.id ? { ...currentTeam, badGolferId: Number(event.target.value) } : currentTeam,
														),
													}))
												}>
												{teamPlayers.map(player => (
													<option key={player.id} value={player.id}>
														{player.name}
													</option>
												))}
											</select>
										</label>
									</article>
								)
							})}
						</div>
					</div>
					<div className="admin-section">
						<h3>Players</h3>
						<div className="admin-grid">
							{adminDraft.players.map(player => {
								const playerTeam = adminDraft.teams.find(team => team.playerIds.includes(player.id))

								return (
									<article key={player.id} className="admin-card">
										<strong>{playerTeam?.name ?? 'Team'}</strong>
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
								)
							})}
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
								['bonusShot', 'Bonus shot points'],
								['mulligan', 'Mulligan points'],
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
					{displayedTeams.map(team => {
						return (
							<article key={team.id} className={`team-card ${getTeamClassName(team.id)}`}>
								<p className="team-name">{team.name}</p>
								<div className="team-points team-total-points">
									<strong>{formatPoints(getTeamStablefordTotal(team, stablefordSettings))}</strong>
									<span>Stableford</span>
								</div>
							</article>
						)
					})}
				</div>
			</section>

			<section className="hole-panel">
				<details className="hole-details">
					<summary>
						<span className="hole-number-display">Hole {currentHole.hole}</span>
						<span>Par {currentHole.par}</span>
					</summary>
					<div className="hole-header">
						<div>
							<span className="stat-label">Par</span>
							<strong>{currentHole.par}</strong>
						</div>
						<div>
							<span className="stat-label">Completed</span>
							<strong>{completedHoleCount}/18</strong>
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
					<p className="hole-status-line">
						{currentHoleComplete ? 'Both teams have entered a scramble score for this hole.' : 'Waiting on both team scramble scores for this hole.'}
					</p>
				</details>
				<div className="hole-entry-list">
					{displayedTeams.map(team => {
						const badGolfer = getBadGolfer(team, players)
						const teamDraft = getDraftForTeam(team.id)

						return (
							<article key={team.id} className={`score-entry-card ${getTeamClassName(team.id)}`}>
								<div className="score-entry-copy minimal-score-entry-copy">
									<p className="team-name">{team.name}</p>
								</div>
								<div className="minimal-input-row">
									<label className="score-field compact-score-field">
										<span>Score</span>
										<input
											className="score-input compact-score-input"
											type="number"
											min="1"
											inputMode="numeric"
											value={teamDraft.score}
											onChange={event => updateTeamScore(team.id, displayHoleIndex, event.target.value)}
											aria-label={`${team.name} scramble score on hole ${currentHole.hole}`}
										/>
									</label>
									<label className="score-field compact-score-field">
										<span>Bonus</span>
										<input
											className="score-input compact-score-input"
											type="number"
											min="0"
											inputMode="numeric"
											value={teamDraft.bonusShotCount}
											onChange={event => updateTeamBonusShotCount(team.id, displayHoleIndex, event.target.value)}
											aria-label={`${team.name} bonus shot count on hole ${currentHole.hole}`}
										/>
									</label>
									<label className="score-field compact-score-field">
										<span>Mulligan</span>
										<input
											className="score-input compact-score-input"
											type="number"
											min="0"
											inputMode="numeric"
											value={teamDraft.mulliganCount}
											onChange={event => updateTeamMulliganCount(team.id, displayHoleIndex, event.target.value)}
											aria-label={`${team.name} mulligan count on hole ${currentHole.hole}`}
										/>
									</label>
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
							const previousHoleIndex = Math.max(0, displayHoleIndex - 1)
							void navigateToHole(previousHoleIndex)
						}}
						disabled={displayHoleIndex === 0}>
						Back
					</button>
					<button
						type="button"
						className="ghost-button"
						onClick={() => {
							const nextHoleIndex = Math.min(course.holes.length - 1, displayHoleIndex + 1)
							void navigateToHole(nextHoleIndex)
						}}
						disabled={displayHoleIndex === course.holes.length - 1}>
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

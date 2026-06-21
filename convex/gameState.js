import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const DEFAULT_PLAYERS = [
	{ id: 1, name: 'Curtis', tee: 'blue' },
	{ id: 2, name: 'Andrew', tee: 'white' },
	{ id: 3, name: 'Mike', tee: 'blue' },
	{ id: 4, name: 'Chris', tee: 'white' },
]

const DEFAULT_TEAMS = [
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

const DEFAULT_STABLEFORD = {
	doubleBogeyOrWorse: 0,
	bogey: 1,
	par: 2,
	birdie: 4,
	eagleOrBetter: 6,
	bonusShot: 2,
	mulligan: -1,
}

function createEmptyScores() {
	return Array(18).fill('')
}

function createEmptyBonusShotCounts() {
	return Array(18).fill(0)
}

function createEmptyMulliganCounts() {
	return Array(18).fill(0)
}

function normalizeBonusShotCounts(existingTeam) {
	if (Array.isArray(existingTeam?.bonusShotCounts) && existingTeam.bonusShotCounts.length === 18) {
		return existingTeam.bonusShotCounts.map(count => Math.max(0, Math.floor(Number(count) || 0)))
	}

	if (Array.isArray(existingTeam?.bonusFlags) && existingTeam.bonusFlags.length === 18) {
		return existingTeam.bonusFlags.map(flag => (flag ? 1 : 0))
	}

	return createEmptyBonusShotCounts()
}

function normalizeMulliganCounts(existingTeam) {
	if (Array.isArray(existingTeam?.mulliganCounts) && existingTeam.mulliganCounts.length === 18) {
		return existingTeam.mulliganCounts.map(count => Math.max(0, Math.floor(Number(count) || 0)))
	}

	return createEmptyMulliganCounts()
}

function deriveTeamScoresFromPlayers(players, playerIds) {
	return Array.from({ length: 18 }, (_, holeIndex) => {
		const validScores = (players ?? [])
			.filter(player => playerIds.includes(player.id))
			.map(player => Number(player.scores?.[holeIndex]))
			.filter(score => Number.isFinite(score) && score > 0)

		if (validScores.length === 0) {
			return ''
		}

		return String(Math.min(...validScores))
	})
}

function createDefaultState() {
	return {
		singletonKey: 'main',
		teams: DEFAULT_TEAMS,
		players: DEFAULT_PLAYERS,
		stableford: DEFAULT_STABLEFORD,
		currentHoleIndex: 0,
	}
}

function normalizePlayers(players) {
	return DEFAULT_PLAYERS.map(defaultPlayer => {
		const existingPlayer = players?.find(player => player.id === defaultPlayer.id)
		return {
			id: defaultPlayer.id,
			name: existingPlayer?.name ?? defaultPlayer.name,
			tee: existingPlayer?.tee === 'blue' ? 'blue' : existingPlayer?.tee === 'white' ? 'white' : defaultPlayer.tee,
		}
	})
}

function normalizeTeams(teams, players) {
	return DEFAULT_TEAMS.map(defaultTeam => {
		const existingTeam = teams?.find(team => team.id === defaultTeam.id)
		return {
			id: defaultTeam.id,
			name: existingTeam?.name ?? defaultTeam.name,
			playerIds: defaultTeam.playerIds,
			badGolferId: defaultTeam.playerIds.includes(existingTeam?.badGolferId) ? existingTeam.badGolferId : defaultTeam.badGolferId,
			scores:
				Array.isArray(existingTeam?.scores) && existingTeam.scores.length === 18
					? existingTeam.scores
					: deriveTeamScoresFromPlayers(players, defaultTeam.playerIds),
			bonusShotCounts: normalizeBonusShotCounts(existingTeam),
			mulliganCounts: normalizeMulliganCounts(existingTeam),
		}
	})
}

function normalizeStableford(stableford) {
	return {
		doubleBogeyOrWorse: Number(stableford?.doubleBogeyOrWorse ?? DEFAULT_STABLEFORD.doubleBogeyOrWorse),
		bogey: Number(stableford?.bogey ?? DEFAULT_STABLEFORD.bogey),
		par: Number(stableford?.par ?? DEFAULT_STABLEFORD.par),
		birdie: Number(stableford?.birdie ?? DEFAULT_STABLEFORD.birdie),
		eagleOrBetter: Number(stableford?.eagleOrBetter ?? DEFAULT_STABLEFORD.eagleOrBetter),
		bonusShot: Number(stableford?.bonusShot ?? DEFAULT_STABLEFORD.bonusShot),
		mulligan: Number(stableford?.mulligan ?? DEFAULT_STABLEFORD.mulligan),
	}
}

function normalizeState(state) {
	return {
		singletonKey: 'main',
		teams: normalizeTeams(state?.teams, state?.players),
		players: normalizePlayers(state?.players),
		stableford: normalizeStableford(state?.stableford),
		currentHoleIndex: Number.isInteger(state?.currentHoleIndex) ? state.currentHoleIndex : 0,
	}
}

async function ensureStateDoc(ctx) {
	const existingState = await ctx.db.query('gameState').first()
	if (existingState) {
		const normalizedState = normalizeState(existingState)
		await ctx.db.patch(existingState._id, normalizedState)
		return await ctx.db.get(existingState._id)
	}

	const stateId = await ctx.db.insert('gameState', createDefaultState())
	return await ctx.db.get(stateId)
}

export const get = query({
	args: {},
	handler: async ctx => {
		const existingState = await ctx.db.query('gameState').first()
		return normalizeState(existingState ?? createDefaultState())
	},
})

export const initialize = mutation({
	args: {},
	handler: async ctx => {
		return await ensureStateDoc(ctx)
	},
})

export const updateTeamHole = mutation({
	args: {
		teamId: v.string(),
		holeIndex: v.number(),
		score: v.string(),
		bonusShotCount: v.optional(v.number()),
		mulliganCount: v.optional(v.number()),
		usedBonusShot: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const state = await ensureStateDoc(ctx)
		const nextTeams = state.teams.map(team => {
			if (team.id !== args.teamId) {
				return team
			}

			const nextScores = [...team.scores]
			nextScores[args.holeIndex] = args.score
			const nextBonusShotCounts = [...team.bonusShotCounts]
			const normalizedBonusShotCount = args.bonusShotCount ?? (args.usedBonusShot ? 1 : 0)
			nextBonusShotCounts[args.holeIndex] = Math.max(0, Math.floor(normalizedBonusShotCount))
			const nextMulliganCounts = [...team.mulliganCounts]
			nextMulliganCounts[args.holeIndex] = Math.max(0, Math.floor(args.mulliganCount ?? 0))
			return {
				...team,
				scores: nextScores,
				bonusShotCounts: nextBonusShotCounts,
				mulliganCounts: nextMulliganCounts,
			}
		})

		await ctx.db.patch(state._id, { teams: nextTeams })
	},
})

export const setCurrentHoleIndex = mutation({
	args: { currentHoleIndex: v.number() },
	handler: async (ctx, args) => {
		const state = await ensureStateDoc(ctx)
		await ctx.db.patch(state._id, { currentHoleIndex: args.currentHoleIndex })
	},
})

export const saveAdminSettings = mutation({
	args: {
		teams: v.array(
			v.object({
				id: v.string(),
				name: v.string(),
				playerIds: v.array(v.number()),
				badGolferId: v.number(),
			}),
		),
		players: v.array(
			v.object({
				id: v.number(),
				name: v.string(),
				tee: v.union(v.literal('blue'), v.literal('white')),
			}),
		),
		stableford: v.object({
			doubleBogeyOrWorse: v.number(),
			bogey: v.number(),
			par: v.number(),
			birdie: v.number(),
			eagleOrBetter: v.number(),
			bonusShot: v.number(),
			mulligan: v.number(),
		}),
	},
	handler: async (ctx, args) => {
		const state = await ensureStateDoc(ctx)
		const nextPlayers = state.players.map(player => {
			const configPlayer = args.players.find(item => item.id === player.id)
			if (!configPlayer) {
				return player
			}

			return {
				...player,
				name: configPlayer.name,
				tee: configPlayer.tee,
			}
		})
		const nextTeams = state.teams.map(team => {
			const configTeam = args.teams.find(item => item.id === team.id)
			if (!configTeam) {
				return team
			}

			return {
				...team,
				name: configTeam.name,
				badGolferId: team.playerIds.includes(configTeam.badGolferId) ? configTeam.badGolferId : team.badGolferId,
			}
		})

		await ctx.db.patch(state._id, {
			teams: nextTeams,
			players: nextPlayers,
			stableford: args.stableford,
		})
	},
})

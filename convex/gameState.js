import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const DEFAULT_PLAYERS = [
	{ id: 1, name: 'Curtis', tee: 'blue', handicap: '12', scores: Array(18).fill('') },
	{ id: 2, name: 'Andrew', tee: 'white', handicap: '14', scores: Array(18).fill('') },
	{ id: 3, name: 'Mike', tee: 'blue', handicap: '8', scores: Array(18).fill('') },
	{ id: 4, name: 'Chris', tee: 'white', handicap: '18', scores: Array(18).fill('') },
]

const DEFAULT_TEAMS = [
	{ id: 'team-1', name: 'Team 1', playerIds: [1, 2] },
	{ id: 'team-2', name: 'Team 2', playerIds: [3, 4] },
]

const DEFAULT_STABLEFORD = {
	doubleBogeyOrWorse: 0,
	bogey: 1,
	par: 2,
	birdie: 4,
	eagleOrBetter: 6,
	lowestNetOnHole: 0,
	highestNetOnHole: 0,
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

async function ensureStateDoc(ctx) {
	const existingState = await ctx.db.query('gameState').first()
	if (existingState) {
		return existingState
	}

	const stateId = await ctx.db.insert('gameState', createDefaultState())
	return await ctx.db.get(stateId)
}

export const get = query({
	args: {},
	handler: async ctx => {
		const existingState = await ctx.db.query('gameState').first()
		return existingState ?? createDefaultState()
	},
})

export const initialize = mutation({
	args: {},
	handler: async ctx => {
		return await ensureStateDoc(ctx)
	},
})

export const updateScore = mutation({
	args: {
		playerId: v.number(),
		holeIndex: v.number(),
		score: v.string(),
	},
	handler: async (ctx, args) => {
		const state = await ensureStateDoc(ctx)
		const nextPlayers = state.players.map(player => {
			if (player.id !== args.playerId) {
				return player
			}

			const nextScores = [...player.scores]
			nextScores[args.holeIndex] = args.score
			return {
				...player,
				scores: nextScores,
			}
		})

		await ctx.db.patch(state._id, { players: nextPlayers })
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
			}),
		),
		players: v.array(
			v.object({
				id: v.number(),
				name: v.string(),
				tee: v.union(v.literal('blue'), v.literal('white')),
				handicap: v.string(),
			}),
		),
		stableford: v.object({
			doubleBogeyOrWorse: v.number(),
			bogey: v.number(),
			par: v.number(),
			birdie: v.number(),
			eagleOrBetter: v.number(),
			lowestNetOnHole: v.number(),
			highestNetOnHole: v.number(),
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
				handicap: configPlayer.handicap,
			}
		})

		await ctx.db.patch(state._id, {
			teams: args.teams,
			players: nextPlayers,
			stableford: args.stableford,
		})
	},
})

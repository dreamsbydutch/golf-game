import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const playerValidator = v.object({
	id: v.number(),
	name: v.string(),
	tee: v.union(v.literal('blue'), v.literal('white')),
	handicap: v.optional(v.string()),
	scores: v.optional(v.array(v.string())),
})

const teamValidator = v.object({
	id: v.string(),
	name: v.string(),
	playerIds: v.array(v.number()),
	badGolferId: v.optional(v.number()),
	scores: v.optional(v.array(v.string())),
	bonusFlags: v.optional(v.array(v.boolean())),
	bonusShotCounts: v.optional(v.array(v.number())),
	mulliganCounts: v.optional(v.array(v.number())),
})

const stablefordValidator = v.object({
	doubleBogeyOrWorse: v.number(),
	bogey: v.number(),
	par: v.number(),
	birdie: v.number(),
	eagleOrBetter: v.number(),
	bonusShot: v.optional(v.number()),
	mulligan: v.optional(v.number()),
	lowestNetOnHole: v.optional(v.number()),
	highestNetOnHole: v.optional(v.number()),
})

export default defineSchema({
	gameState: defineTable({
		singletonKey: v.string(),
		teams: v.array(teamValidator),
		players: v.array(playerValidator),
		stableford: stablefordValidator,
		currentHoleIndex: v.number(),
	}),
})

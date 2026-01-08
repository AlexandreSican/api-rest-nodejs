import { knex } from "../database"
import { z } from 'zod'
import crypto, { randomUUID } from 'node:crypto'
import { FastifyInstance } from "fastify"
import { checkSessionIsExists } from "../middlewares/check-session-id-exist"

export async function transactionsRoutes(app: FastifyInstance) {

    app.addHook('preHandler', async (request, reply) => {
        console.log(`[${request.method}] ${request.url}`)
    })

    app.get('/', {
        preHandler: [
            checkSessionIsExists
        ]
    }, async (request) => {

        const { sessionId } = request.cookies

        const transactions = await knex('transactions')
            .where('session_id', sessionId)
            .select()

        return { transactions }
    })

    app.get('/:id', {
        preHandler: [
            checkSessionIsExists
        ]
    }, async (request) => {
        const getTransactionParamsSchema = z.object({
            id: z.uuid(),
        })

        const { id } = getTransactionParamsSchema.parse(request.params)

        const { sessionId } = request.cookies

        const transaction = await knex('transactions').where({
            session_id: sessionId,
            id,
        }).first()

        return { transaction }
    })

    app.get('/summary', {
        preHandler: [
            checkSessionIsExists
        ]
    }, async (request) => {

        const { sessionId } = request.cookies

        const summary = await knex('transactions').sum('amount', { as: 'amount' }).where('session_id', sessionId).first()

        return { summary }
    })


    app.post('/', async (request, reply) => {

        const createTransactionsBodySchema = z.object({
            title: z.string(),
            amount: z.number(),
            type: z.enum(['credit', 'debit']),
        })

        const { title, amount, type } = createTransactionsBodySchema.parse(request.body)

        let sessionId = request.cookies.sessionId

        if (!sessionId) {
            sessionId = randomUUID()

            reply.cookie('sessionId', sessionId, {
                path: '/',
                maxAge: 60 * 60 * 24 * 7, //7 days
            })
        }

        await knex('transactions')
            .insert({
                id: crypto.randomUUID(),
                title,
                amount: type === 'credit' ? amount : amount * -1,
                session_id: sessionId,
            })

        return reply.status(201).send()
    })
}
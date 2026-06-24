import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server, Socket } from 'socket.io';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { handleChatMessage } from './ai/agent';
// Mock repository imports for the hackathon
// Ensure these functions exist in your actual src/db/repository.ts
import { saveMessage, getConversationHistory, createTicket, getAllTickets } from './db/repository';

dotenv.config();

const fastify = Fastify({ logger: true });

fastify.register(cors, { origin: '*' });

// ─── Health Check ────────────────────────────────────────────────────────────
fastify.get('/health', async () => ({
  status: 'ok',
  service: 'Flowzint OmniCare AI Backend',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

// ─── REST Routes ─────────────────────────────────────────────────────────────
fastify.get('/api/conversations/:sessionId', async (req: any, reply) => {
  try {
      const history = await getConversationHistory(req.params.sessionId);
      return history;
  } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: "Failed to fetch history" });
  }
});

fastify.get('/api/tickets', async (req, reply) => {
  try {
      const tickets = await getAllTickets();
      return tickets;
  } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: "Failed to fetch tickets" });
  }
});

fastify.post('/api/tickets', async (req: any, reply) => {
  const { sessionId, subject, priority, description } = req.body;
  try {
      const ticket = await createTicket({ sessionId, subject, priority, description });
      return ticket;
  } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: "Failed to create ticket" });
  }
});

// ─── Server Startup & WebSockets ──────────────────────────────────────────────
const start = async () => {
  try {
    await fastify.ready();

    const io = new Server(fastify.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    io.on('connection', (socket: Socket) => {
      const sessionId = (socket.handshake.query.sessionId as string) || uuidv4();
      fastify.log.info(`Client connected: ${socket.id} | Session: ${sessionId}`);

      socket.emit('session_init', { sessionId });

      socket.on('chat_message', async (data: { content: string; sessionId: string }) => {
        const userMsg = data.content?.trim();
        if (!userMsg) return;

        // Persist user message
        await saveMessage({ sessionId: data.sessionId, role: 'user', content: userMsg });

        // Signal to the frontend that the AI has started processing
        socket.emit('chat_response', { type: 'start' });

        let fullResponse = '';
        try {
          // Call the OpenRouter Agent logic
          await handleChatMessage({
            message: userMsg,
            sessionId: data.sessionId,
            onToken: (token: string) => {
              fullResponse += token;
              // Stream individual tokens back to the React frontend
              socket.emit('chat_response', { type: 'token', content: token });
            },
            onSentiment: (sentiment) => {
              // Send real-time sentiment data to the frontend sidebar
              socket.emit('session_context', { type: 'sentiment', data: sentiment });
            },
            onIntent: (intent) => {
              // Send real-time intent detection to the frontend sidebar
              socket.emit('session_context', { type: 'intent', data: intent });
            },
          });
        } catch (err: any) {
          fastify.log.error(err);
          socket.emit('chat_response', {
            type: 'token',
            content: "I'm sorry, I encountered an error communicating with the main server. Please try again.",
          });
        }

        // Persist AI response once complete
        await saveMessage({ sessionId: data.sessionId, role: 'assistant', content: fullResponse });
        // Signal to the frontend that the message is complete
        socket.emit('chat_response', { type: 'done' });
      });

      socket.on('typing_start', () => socket.broadcast.emit('agent_typing', true));
      socket.on('typing_stop', () => socket.broadcast.emit('agent_typing', false));

      socket.on('disconnect', () => {
        fastify.log.info(`Client disconnected: ${socket.id}`);
      });
    });

    const PORT = parseInt(process.env.PORT || '3001');
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`🚀 OmniCare AI Backend running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
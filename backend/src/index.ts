import 'reflect-metadata';
import express from 'express';
import documentRoutes from './routes/documentRoutes';
import './db/db';
import { createServer } from 'http'
import { Server } from 'socket.io'
import { processOperation } from './services/otService';
import authRoutes from './routes/authRoutes';
import morgan from 'morgan';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

const app = express()
app.use(express.json())
app.use(morgan('combined'));

// Public auth routes
app.use('/api/auth', authRoutes);

// REST routes
app.use('/api/documents', documentRoutes);

// Create HTTP + WebSocket server
const httpServer = createServer(app)
const io = new Server(httpServer, {
	cors: {
		origin: "*"
	}
})

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

function pickRandomColor(): string {
  const colors = ['#FF5733', '#33FF99', '#3349FF', '#FF33E2', '#FFC433', '#92FF33'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Replace top-level awaits with an async function
async function initializeRedis() {
	await pubClient.connect();
	await subClient.connect();
	io.adapter(createAdapter(pubClient, subClient));
}

initializeRedis().catch((err) => {
  console.error('Failed to connect to Redis:', err);
  process.exit(1);
});

// Optional Socket.io middleware for auth
io.use((socket, next) => {
	const token = socket.handshake.auth.token; // or from cookies
	console.log({ token })
	next();
});

io.on('connection', async (socket) => {

  // Increment a global counter
  await pubClient.incr('global:socketCount');

	// e.g. user logs in or identifies as userId
	const userId = socket.handshake.auth.userId;
	
	socket.on('joinDoc', async (docId: string) => {
		socket.join(`doc_${docId}`);
		console.log(`User ${socket.id} joined room doc_${docId}`);

		await pubClient.sAdd(`doc:${docId}:activeUsers`, userId);

		// b) Assign color if not already in Redis
		let userColor = await pubClient.get(`userColor:${userId}`);
		if (!userColor) {
			userColor = pickRandomColor();
			await pubClient.set(`userColor:${userId}`, userColor);
		}
		
		// c) Broadcast that a user joined (with color) to the doc
		io.to(`doc_${docId}`).emit('userJoined', {
			userId,
			color: userColor,
		});
	});

	// Listen for operational transforms or text changes
	socket.on('operation', async (data) => {
		const { docId, operation, baseVersion } = data;

		try {
			const { finalOp, newVersion } = await processOperation(docId, operation, baseVersion);

			// Broadcast to other clients in the same room
			socket.to(`doc_${docId}`).emit('operation', { operation: finalOp, version: newVersion });
		} catch (error: any) {
			console.error(error);
			// Optionally emit an error event to the client
			socket.emit('operationError', { message: error.message });
		}
	});

	socket.on('cursor', (data) => {
		socket.to(`doc_${data.docId}`).emit('cursor', data);
	});

	socket.on('disconnect', async (docId) => {
		console.log('A user disconnected:', socket.id);

		await pubClient.decr('global:socketCount');
		
		await pubClient.sRem(`doc:${docId}:activeUsers`, userId);
	});

})

const PORT = process.env.PORT || 8000;

httpServer.listen(PORT, async () => {
	console.log(`Server listening on port http://localhost:${PORT}`);
});
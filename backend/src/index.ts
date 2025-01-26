import 'reflect-metadata';
import express from 'express';
import documentRoutes from './routes/documentRoutes';
import './db/db';
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { processOperation } from './services/otService';
import authRoutes from './routes/authRoutes';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors'

interface DecodedToken {
  userId: string;
  username: string;
}

const app = express()
app.use(express.json())
app.use(cors());

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

io.on('connection', async (socket) => {
  await pubClient.incr('global:socketCount');
	const userId = socket.handshake.auth.userId;
	let currentDocId: string | null = null;

	socket.on('joinDoc', async (docId: string) => {

		if(currentDocId) {
			await handleDocumentLeave(socket, currentDocId, userId);
		}

		currentDocId = docId;
		socket.join(`doc_${docId}`);

		if(userId) {
			await pubClient.sAdd(`doc:${docId}:activeUsers`, userId);
			let userColor = await pubClient.get(`userColor:${userId}`);
			if (!userColor) {
				userColor = pickRandomColor();
				await pubClient.set(`userColor:${userId}`, userColor);
			}

      // Broadcast to all clients in room including sender
      io.to(`doc_${docId}`).emit('userJoined', {
        userId,
        color: userColor,
      });

			const activeUsers = await pubClient.sMembers(`doc:${docId}:activeUsers`);
			const activeUsersInfo = await Promise.all(
				activeUsers.map(async(uid) => ({
					userId: uid,
					color: await pubClient.get(`userColor:${uid}`)
				}))
			);
			socket.emit('activeUsers', activeUsersInfo);
		}
	});

	// Listen for operational transforms or text changes
	socket.on('operation', async (data) => {
		const { docId, operation, baseVersion } = data;
		try {
			const { finalOp, newVersion: version } = await processOperation(docId, operation, baseVersion);
			io.to(`doc_${docId}`).emit('operation', { operation: finalOp, version, userId });
		} catch (error: any) {
			console.error(error);
			socket.emit('operationError', { message: error.message });
		}
	});

	socket.on('cursor', async (data) => {
		if(!userId) return;
		const userColor = await pubClient.get(`userColor:${userId}`)
		io.to(`doc_${data.docId}`).emit('cursor', {
			userId,
			position: {
				...data.position,
				color: userColor
			}
		})
	});

	// socket.on('operationError', (error) => {
	// 	// Reload the document if we get out of sync
	// 	if (error.message.includes('Version mismatch')) {
	// 		loadDocument();
	// 	}
	// });

	socket.on('disconnect', async () => {
		if(currentDocId && userId) {
			await handleDocumentLeave(socket, currentDocId, userId)
		}
		await pubClient.decr('global:socketCount');
	});
})

async function handleDocumentLeave(socket: Socket, docId: string, userId: string) {
	await pubClient.sRem(`doc:${docId}:activeUsers`, userId);
	socket.to(`doc_${docId}`).emit('userLeft', userId);
}

const PORT = process.env.PORT || 8000;

httpServer.listen(PORT, async () => {
	console.log(`Server listening on port http://localhost:${PORT}`);
});
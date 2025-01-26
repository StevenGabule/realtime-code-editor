import express from 'express';
import { createDocument, getDocument, getDocuments } from '../controllers/documentController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', authMiddleware,getDocuments);
router.post('/', authMiddleware, createDocument);
router.get('/:id', authMiddleware,getDocument);

export default router;

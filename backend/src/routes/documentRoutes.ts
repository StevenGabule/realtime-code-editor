import express from 'express';
import { createDocument, getDocument } from '../controllers/documentController';

const router = express.Router();

router.post('/', createDocument);
router.get('/:id', getDocument);

export default router;

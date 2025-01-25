import { Request, RequestHandler, Response } from 'express';
import { Document } from '../models/Document';
import { AppDataSource } from '../db/db';

export const createDocument: RequestHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const docRepo = AppDataSource.getRepository(Document);
    const { title, content } = req.body;
    const newDoc = docRepo.create({ title, content });
    await docRepo.save(newDoc);
    return res.status(201).json(newDoc);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const getDocument: RequestHandler  = async (req: Request, res: Response):  Promise<any> => {
  try {
    const docRepo = AppDataSource.getRepository(Document);
		// @ts-ignore
    const doc = await docRepo.findOne(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    return res.json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: number;
  username: string;
  iat: number; // issued at
  exp: number; // expiration
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ message: 'Authorization header missing' });
      return
    }

    const token = authHeader.split(' ')[1]; // "Bearer <token>"
    if (!token) {
      res.status(401).json({ message: 'Token missing' });
      return
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    (req as AuthRequest).user = decoded;

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
    return
  }
}

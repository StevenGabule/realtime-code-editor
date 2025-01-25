import 'reflect-metadata';
import { AppDataSource } from './../db/db';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 10; // for bcrypt

/**
 * POST /api/auth/register
 */
export const registerUser = async (req: Request, res: Response) : Promise<any> => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const { username, email, password } = req.body;

    // Check if username already exists
    const existingUser = await userRepo.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken.' });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create and save the user
    const user = userRepo.create({ username, email, passwordHash });
    await userRepo.save(user);

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Register Error: ', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/auth/login
 */
export const loginUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const { username, password } = req.body;

    // Find user by username
    const user = await userRepo.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' } // token valid for 1 hour
    );

    return res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login Error: ', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

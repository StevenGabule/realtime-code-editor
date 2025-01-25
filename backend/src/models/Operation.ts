import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Document } from './Document';

@Entity()
export class Operation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  baseVersion!: number;

  // The actual operation, stored as JSON
  // Example: { type: 'insert', position: 5, text: 'Hello' }
  @Column('json')
  data!: any;

  // Link to the Document being edited
  @ManyToOne(() => Document)
  @JoinColumn({ name: 'documentId' })
  document!: Document;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

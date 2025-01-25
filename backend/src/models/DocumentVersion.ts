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
export class DocumentVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  // Version number, e.g. 1, 2, 3...
  @Column()
  versionNumber!: number;

  // Snapshot of the document content at this version
  @Column('text')
  contentSnapshot!: string;

  // Reference to the main Document
  @ManyToOne(() => Document)
  @JoinColumn({ name: 'documentId' })
  document!: Document;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

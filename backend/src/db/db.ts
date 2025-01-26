import { DataSource } from 'typeorm';
import { Document } from '../models/Document';
import { Operation } from '../models/Operation';
import { User } from '../models/User';
import { DocumentVersion } from '../models/DocumentVersion';

export const AppDataSource = new DataSource({
	type: "mysql",
	host: "172.19.80.1",
	port: 3307,
	username: "jpgabs",
	password: "password",
	database: "realtime_editor_db",
	entities: [Document, Operation, User, DocumentVersion],
	synchronize: true,
})

AppDataSource.initialize()
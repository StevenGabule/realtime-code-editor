import 'reflect-metadata';
import express from 'express';
import {DataSource} from 'typeorm'
import documentRoutes from './routes/documentRoutes';

const app = express()
app.use(express.json())

export const AppDataSource = new DataSource({
	type: "mysql",
	host: "172.19.80.1",
	port: 3307,
	username: "jpgabs",
	password: "password",
	database: "realtime_editor_db",
	entities: [__dirname + '/models/*.ts'],
})

AppDataSource.initialize()
    .then(() => {
				app.use('/api/documents', documentRoutes);
				const PORT = process.env.PORT || 4000;
				app.listen(PORT, () => {
					console.log(`Server listening on port ${PORT}`);
				});
    })
    .catch((err) => {
        console.error("Error during Data Source initialization", err)
    })
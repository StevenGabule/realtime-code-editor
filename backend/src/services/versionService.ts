import { Document } from '../models/Document';
import { DocumentVersion } from '../models/DocumentVersion';
import { AppDataSource } from './../db/db';
/**
 * Creates a snapshot of a document's current content at a specific version.
 * @param docId        ID of the document
 * @param currentContent The content to snapshot
 * @param versionNumber  The version number for this snapshot
 */
export async function createSnapshot(docId: number, currentContent: string, versionNumber: number) {
  try {
    const docVersionRepo = AppDataSource.getRepository(DocumentVersion);
    const documentRepo = AppDataSource.getRepository(Document);

    // Ensure the Document exists (optional but recommended)
    const document = await documentRepo.findOne({where: {id: docId}});
    if (!document) {
      throw new Error(`Document with ID ${docId} not found`);
    }

    // Create the snapshot record
    const snapshot = docVersionRepo.create({
      document,
      contentSnapshot: currentContent,
      versionNumber,
    });

    // Save to the database
    await docVersionRepo.save(snapshot);

    return snapshot;
  } catch (error) {
    console.error('Error creating snapshot:', error);
    throw error;
  }
}
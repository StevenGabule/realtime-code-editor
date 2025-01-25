import { AppDataSource } from './../db/db';
import { MoreThan } from 'typeorm';
import { Document } from '../models/Document';
import { Operation } from '../models/Operation';
import { createSnapshot } from './versionService';

interface OperationData  {
  position: number;
  type: 'insert' | 'delete';
  text?: string;
  length?: number;
}


/**
 * transform
 * A naive example that adjusts insertion/deletion positions
 * based on subsequent operations. Real OT is more complex.
 */
export function transform(op1: OperationData , op2: OperationData ): OperationData  {
	if (op1.type === 'insert' && op2.type === 'insert') {
    // If op2 insertion is before or at op1's position, shift op1
    if (op2.position <= op1.position) {
      const shift = op2.text ? op2.text.length : 0;
      return {
        ...op1,
        position: op1.position + shift,
      };
    }
  }
  // Example: handle delete vs insert
  if (op1.type === 'delete' && op2.type === 'insert') {
    // If op2 insertion is before or at op1's position, shift op1
    if (op2.position <= op1.position) {
      const shift = op2.text ? op2.text.length : 0;
      return {
        ...op1,
        position: op1.position + shift,
      };
    }
  }

  // Additional combos (delete vs delete, insert vs delete, etc.)
  // For brevity, skip or handle similarly
  return op1;
}


/**
 * applyOperation
 * Actually modifies the string based on the operation
 */
function applyOperation(content: string, op: OperationData ): string {
	switch (op.type) {
		case 'insert':
			return (
				content.slice(0, op.position) +
				(op.text || '') + 
				content.slice(op.position)
			)
		case 'delete':
			return (
				content.slice(0, op.position) + 
				content.slice(op.position + (op.length || 0))
			)
		default:
			return content;
	}
}

/**
 * processOperation
 * @param docId - The ID of the Document being edited
 * @param incomingOp - The operation details sent from the client
 * @param baseVersion - The document version at which the operation was created on the client
 */
export async function processOperation(docId: number, incomingOp: OperationData, baseVersion: number) : Promise<{finalOp: OperationData; newVersion: number}>{
  // 1. Get the current doc from DB
  const docRepo = AppDataSource.getRepository(Document);
  const opRepo = AppDataSource.getRepository(Operation);

  const doc = await docRepo.findOne({where: {id: docId}});
  if (!doc) {
    throw new Error(`Document with ID ${docId} not found`);
  }

  // 2. Fetch operations that happened from baseVersion+1 to currentVersion
	const subsequentOps = await opRepo.find({
    where: {
      document: doc,
      baseVersion: MoreThan(baseVersion),
    },
    order: { baseVersion: 'ASC' },
  });

  // 3. Transform incomingOp against each operation in chronological order
  let finalOp = { ...incomingOp };
  for (const existingOp of subsequentOps) {
    finalOp = transform(finalOp, existingOp.data);
  }

  // 4. Apply the transformed operation to document content
  const newContent = applyOperation(doc.content, finalOp);

  // 5. Save new operation to DB with newVersion = currentVersion + 1
  let currentMaxVersion = baseVersion;
  if (subsequentOps.length > 0) {
    currentMaxVersion = subsequentOps[subsequentOps.length - 1].baseVersion;
  }
  const newVersion = currentMaxVersion + 1;

  // 6. Update document content and version
  const newOp = opRepo.create({
    baseVersion: newVersion,
    data: finalOp,
    document: doc,
  });
  await opRepo.save(newOp);

  // 7. Return the final operation and new version
  doc.content = newContent;
  await docRepo.save(doc);

	if (newVersion % 10 === 0) {
    // Snapshot every 10 operations, for example
    await createSnapshot(docId, newContent, newVersion);
  }
	
  // 8. Return the final operation + new version
  return { finalOp, newVersion };
}
import { AppDataSource } from './../db/db';
import { MoreThan } from 'typeorm';
import { Document } from '../models/Document';
import { Operation } from '../models/Operation';

interface OperationData {
  position: number;
  type: 'insert' | 'delete';
  text?: string;
  length?: number;
}

export async function processOperation(docId: number, operation: any, baseVersion: number) {
  const opRepo = AppDataSource.getRepository(Operation);

  // Use a transaction to ensure consistency
  return await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
    const doc = await transactionalEntityManager.findOne(Document, { 
      where: { id: docId },
      lock: { mode: 'pessimistic_write' }  // Lock the document during processing
    });

    if (!doc) {
      throw new Error(`Document with ID ${docId} not found`);
    }

    // Get subsequent operations
    const subsequentOps = await transactionalEntityManager.find(Operation, {
      where: {
        document: { id: docId },
        baseVersion: MoreThan(baseVersion)
      }
    });

    // Transform operation against all subsequent ops
    let finalOp = { ...operation };
    for (const existingOp of subsequentOps) {
      finalOp = transform(finalOp, existingOp.data);
    }

    const newVersion = baseVersion + subsequentOps.length + 1;

    // Save the operation
    const newOp = opRepo.create({
      baseVersion: newVersion,
      data: finalOp,
      document: { id: docId }
    });

    await transactionalEntityManager.save(newOp);

    // Apply operation to document content
    const newContent = applyOperation(doc.content, finalOp);
    console.log({newContent})
    console.log({finalOp})
    doc.content = applyOperation(doc.content, finalOp);
    doc.version = newVersion;
    await transactionalEntityManager.save(doc);

    return { finalOp, newVersion };
  });
}

function applyOperation(content: string, operation: OperationData): string {
  const currentContent = content || '';
  
  console.log('Operation:', {
    type: operation.type,
    position: operation.position,
    text: operation.text,
    length: operation.length
  });
  console.log('Before content:', currentContent);
  
  try {
    let result = currentContent;
    
    switch (operation.type) {
      case 'insert':
        if (!operation.text) {
          console.log('No text to insert');
          return currentContent;
        }
        const insertPos = Math.min(Math.max(0, operation.position), currentContent.length);
        result = currentContent.slice(0, insertPos) + operation.text + currentContent.slice(insertPos);
        break;
        
      case 'delete':
        if (!operation.length) {
          console.log('No length specified for delete');
          return currentContent;
        }
        const deletePos = Math.min(Math.max(0, operation.position), currentContent.length);
        const deleteLength = Math.min(operation.length, currentContent.length - deletePos);
        result = currentContent.slice(0, deletePos) + currentContent.slice(deletePos + deleteLength);
        break;
        
      default:
        console.log('Unknown operation type:', operation.type);
        return currentContent;
    }
    
    console.log('After content:', result);
    return result;
    
  } catch (error) {
    console.error('Error applying operation:', error);
    return currentContent;
  }
}

function transform(op1: OperationData, op2: OperationData): OperationData {
  // If operations are at different positions, no transform needed
  if (op1.position >= op2.position + (op2.type === 'delete' ? (op2.length || 0) : (op2.text?.length || 0)) || 
      op2.position >= op1.position + (op1.type === 'delete' ? (op1.length || 0) : (op1.text?.length || 0))) {
    return op1;
  }

  switch (op1.type) {
    case 'insert':
      switch (op2.type) {
        case 'insert':
          // If both are inserts, adjust position based on which came first
          if (op2.position <= op1.position) {
            return {
              ...op1,
              position: op1.position + (op2.text?.length || 0)
            };
          }
          return op1;

        case 'delete':
          // If op2 deletes before op1's position, adjust position
          if (op2.position < op1.position) {
            return {
              ...op1,
              position: Math.max(op2.position, op1.position - (op2.length || 0))
            };
          }
          return op1;
      }
      break;

    case 'delete':
      switch (op2.type) {
        case 'insert':
          // If inserting before delete, adjust position
          if (op2.position <= op1.position) {
            return {
              ...op1,
              position: op1.position + (op2.text?.length || 0)
            };
          }
          return op1;

        case 'delete':
          // Handle overlapping deletes
          if (op2.position < op1.position) {
            return {
              ...op1,
              position: op1.position - Math.min(op1.position - op2.position, op2.length || 0),
              length: op1.length
            };
          }
          return op1;
      }
      break;
  }

  return op1;
}
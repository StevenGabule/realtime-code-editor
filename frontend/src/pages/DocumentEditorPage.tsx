import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDocumentById } from '../services/api';
import { getSocket } from '../services/socket';
import Editor from '../components/Editor/Editor';
import { jwtDecode } from 'jwt-decode';
import { debounce } from 'lodash';

interface DecodedToken {
  userId: string;
}

interface Operation {
  type: 'insert' | 'delete';
  position: number;
  text?: string;
  length?: number;
}

interface OperationData {
  userId: string;
  version: number;
  operation: Operation;
}

function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState('');
  const [userId, setUserId] = useState<string>('')
  const [version, setVersion] = useState(0);
  const [activeUsers, setActiveUsers] = useState<Map<string, string>>(new Map())
  const [pendingOperations, setPendingOperations] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      const decoded = jwtDecode<DecodedToken>(token) as DecodedToken
      setUserId(decoded.userId)
    }
  }, [])

  // Handle incoming operations
  const handleIncomingOperation = useCallback((data: OperationData) => {
    if (String(data.userId) === userId) {
      setVersion(data.version);
      return;
    }

    setContent(prevContent => applyOperation(prevContent, data.operation));
    setVersion(data.version);
  }, [userId]);

  useEffect(() => {
    if (!id && !userId) return;

    const loadDocument = async () => {
      try {
        const doc = await getDocumentById(id!);
        setContent(doc.content);
        setVersion(doc.version);
      } catch (error) {
        console.error('Error loading document: ', error);
      }
    }

    loadDocument()

    const socket = getSocket();
    if (socket) {
      socket.emit('joinDoc', id);
      socket.on('operation', handleIncomingOperation);
      socket.on('userJoined', (data) => {
        setActiveUsers(prev => new Map(prev).set(data.userId, data.color));
      });

      socket.on('userLeft', (userId) => {
        setActiveUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
      });
    }

    return () => {
      if (socket) {
        socket.off('operation', handleIncomingOperation);
        socket.off('userJoined');
        socket.off('userLeft');
        socket.emit('leaveDoc', id);
      }
    };
  }, [id, userId, handleIncomingOperation]);

  // Apply buffered operations when possible
  useEffect(() => {
    if (pendingOperations.length === 0) return;

    const nextOperation = pendingOperations[0];
    const socket = getSocket();

    if (socket) {
      socket.emit('operation', {
        docId: id,
        operation: nextOperation,
        baseVersion: version
      });

      setPendingOperations(prev => prev.slice(1));
    }
  }, [pendingOperations, version, id]);

  const computeDiff = useCallback((oldText: string, newText: string): Operation | null => {
    if (oldText === newText) return null;

    let i = 0;
    while (i < oldText.length && i < newText.length && oldText[i] === newText[i]) {
      i++;
    }

    let j = 0;
    while (
      j < oldText.length - i &&
      j < newText.length - i &&
      oldText[oldText.length - 1 - j] === newText[newText.length - 1 - j]
    ) {
      j++;
    }

    const oldMiddle = oldText.slice(i, oldText.length - j);
    const newMiddle = newText.slice(i, newText.length - j);

    if (newMiddle.length > 0) {
      return {
        type: 'insert',
        position: i,
        text: newMiddle
      };
    } else if (oldMiddle.length > 0) {
      return {
        type: 'delete',
        position: i,
        length: oldMiddle.length
      };
    }

    return null;
  }, []);

  const handleLocalEdit = useCallback(
    debounce((newContent: string) => {
      const operation = computeDiff(content, newContent);
      if (!operation) return;

      setPendingOperations(prev => [...prev, operation]);
    }, 50),
    [content, computeDiff]
  );

  if (!userId) {
    return <div>Loading...</div>;
  }

  return (
    <div className='h-screen w-full'>
      <h1>Document Editor (ID: {id})</h1>
      <div className="active-users">
        {Array.from(activeUsers).map(([userId, color]) => (
          <div key={userId} className='user-indicator' style={{ backgroundColor: color }}>
            User {userId}
          </div>
        ))}
      </div>
      <div className='h-[800px] w-full'>
        <Editor docId={Number(id)} content={content} onChange={handleLocalEdit} userId={Number(userId)} />
      </div>
    </div>
  );
}

function applyOperation(oldText: string, operation: Operation): string {
  if (operation.type === 'insert' && operation.text) {
    return (
      oldText.slice(0, operation.position) +
      operation.text +
      oldText.slice(operation.position)
    );
  } else if (operation.type === 'delete' && operation.length) {
    return (
      oldText.slice(0, operation.position) +
      oldText.slice(operation.position + operation.length)
    );
  }
  return oldText;
}

export default DocumentEditorPage;

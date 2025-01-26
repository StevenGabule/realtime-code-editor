// src/pages/DocumentListPage.tsx
import { useEffect, useState } from 'react';
import { getDocuments, createDocument } from '../services/api';
import { useNavigate } from 'react-router-dom';

function DocumentListPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<any[]>([]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const data = await getDocuments();
      setDocs(data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const handleCreateDoc = async () => {
    if (!title) return;
    try {
      const newDoc = await createDocument(title, '');
      navigate(`/doc/${newDoc.id}`);
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  };

  return (
    <div>
      <h1>Documents</h1>
      <ul>
        {docs.map((doc) => (
          <li key={doc.id} onClick={() => navigate(`/doc/${doc.id}`)}>
            {doc.title}
          </li>
        ))}
      </ul>
      <input
        placeholder="New Document Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button onClick={handleCreateDoc}>Create Document</button>
    </div>
  );
}

export default DocumentListPage;

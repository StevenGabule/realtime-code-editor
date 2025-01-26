import { Editor as MonacoEditor, loader } from '@monaco-editor/react';
import * as Monaco from 'monaco-editor';
import { useRef, useEffect } from 'react';
import { getSocket } from '../../services/socket'

// Configure Monaco loader
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.36.1/min/vs' } });

interface EditorProps {
  docId: number;
  content: string;
  onChange: (newContent: string) => void;
  userId: number;
}

function Editor({ content, onChange, userId, docId }: EditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<{ [key: string]: string[] }>({})

  const handleEditorDidMount = (editor: Monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((event) => {
      const socket = getSocket();
      if (!socket) return;

      socket.emit('cursor', {
        docId,
        userId,
        position: {
          lineNumber: event.position.lineNumber,
          column: event.position.column
        }
      });
    });
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCursorUpdate = (data: any) => {
      if (data.userId === userId || !editorRef.current) return;

      if (decorationsRef.current[data.userId]) {
        editorRef.current.deltaDecorations(decorationsRef.current[data.userId], [])
      }

      // add new cursor decoration
      const decorations = [{
        range: new Monaco.Range(
          data.position.lineNumber,
          data.position.column,
          data.position.lineNumber,
          data.position.column
        ),
        options: {
          className: `cursor-decoration-${data.userId}`,
          glyphMarginClassName: `cursor-glyph-${data.userId}`,
          hoverMessage: { value: `User ${data.userId}` },
          zIndex: 100
        }
      }];

      decorationsRef.current[data.userId] = editorRef.current.deltaDecorations(
        decorationsRef.current[data.userId] || [],
        decorations
      )

      // Add dynamic styles for this user's cursor
      const style = document.createElement('style');
      style.innerHTML = `
        .cursor-decoration-${data.userId} {
          background-color: ${data.color};
          width: 2px !important;
          margin-left: -1px;
        }
        .cursor-glyph-${data.userId} {
          background-color: ${data.color};
          width: 4px !important;
        }
      `;
      document.head.appendChild(style);
    };

    socket.on('cursor', handleCursorUpdate)

    return () => {
      socket.off('cursor', handleCursorUpdate);
    }
  }, [docId, userId])

  return (<MonacoEditor
    height="100%"
    width="100%"
    defaultLanguage="typescript"
    theme="vs-dark"
    value={content}
    onChange={(value) => onChange(value || '')}
    onMount={handleEditorDidMount}
    options={{
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      fontSize: 14,
      wordWrap: 'on',
      automaticLayout: true
    }}
  />);
}

export default Editor;

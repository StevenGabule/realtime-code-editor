import { BrowserRouter, Route, Routes } from 'react-router-dom'
import DocumentListPage from './pages/DocumentListPage'
import LoginPage from './pages/LoginPage'
import DocumentEditorPage from './pages/DocumentEditorPage'
import { useEffect } from 'react';
import { initSocket } from './services/socket';

function App() {

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId') || 'anonymous';
    if (token) {
      console.log({token})
      console.log({userId})
      initSocket(token, userId);
    }
  }, []);

  return (
    <BrowserRouter>
    <Routes>
      <Route path='/register' element={<DocumentListPage />}></Route>
      <Route path='/login' element={<LoginPage />}></Route>
      <Route path='/' element={<DocumentListPage />}></Route>
      <Route path='/doc/:id' element={<DocumentEditorPage />}></Route>
    </Routes>
    </BrowserRouter>
  )
}

export default App

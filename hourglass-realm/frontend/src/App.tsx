import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Portal from './portal/Portal'
import Admin from './portal/Admin'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/admin" element={<Admin />} />
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
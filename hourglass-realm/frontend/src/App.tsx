import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Portal from './portal/Portal'
import Admin from './portal/Admin'
import Credits from './portal/Credits';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/credits" element={<Credits />} />
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </HashRouter>
  );
}

export default App;
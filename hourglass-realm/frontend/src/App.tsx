import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Portal from './portal/Portal'
import Admin from './portal/Admin'
import Credits from './portal/Credits';
import { APP_BASE_PATH } from './utils/constants';

function App() {
  return (
    <BrowserRouter basename={APP_BASE_PATH.replace(/\/+$/, '')}>
      <Routes>
        <Route path="/" element={<Portal />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/credits" element={<Credits />} />
        {/* <Route
          path="*"
          element={<Navigate to="/" replace />}
        /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import { Routes, Route, Navigate } from 'react-router-dom'
import DataAskApp from './components/DataAskApp'

function App() {
  return (
    <Routes>
      <Route path="/" element={<DataAskApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App 
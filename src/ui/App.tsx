import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VideoList from './pages/VideoList';
import VideoCreator from './pages/VideoCreator';
import VideoDetails from './pages/VideoDetails';
import { IntegratedEditorPage } from './pages/IntegratedEditorPage';
import { FantaSitePage } from './pages/FantaSitePage';
import Layout from './components/Layout';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<VideoList />} />
          <Route path="/create" element={<VideoCreator />} />
          <Route path="/video/:videoId" element={<VideoDetails />} />
          <Route path="/editor" element={<IntegratedEditorPage />} />
          <Route path="/fanta-site" element={<FantaSitePage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App; 
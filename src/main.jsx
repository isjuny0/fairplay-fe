import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import App from './App.jsx';
import InteractionProvider from './components/InteractionProvider.jsx';
import './styles.css';

const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <InteractionProvider>
        <App />
      </InteractionProvider>
    ),
  },
]);
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} useTransitions={false} />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import App from './App.jsx';
import RouteViewport from './components/RouteViewport.jsx';
import InteractionProvider from './components/InteractionProvider.jsx';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './design-tokens.css';
import './styles.css';
import './workspace-theme.css';
import './workspace-components.css';

const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <InteractionProvider>
        <RouteViewport />
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

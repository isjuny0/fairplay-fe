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
import './member-workspace.css';
import './admin-workspace.css';
import './entry-workspace.css';
import './task-detail.css';
import './task-review.css';
import './task-editor.css';
import './deliverable-editor.css';
import './manager-peer-review.css';
import './resource-states.css';
import './deliverable-search.css';
import './review-workflow.css';
import './task-collection.css';
import './collection-filters.css';

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

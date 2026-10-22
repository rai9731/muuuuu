import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { initSentry } from '@services/sentry';
import { AuthProvider } from '@hooks/useAuth';
import { ToastProvider } from '@hooks/useToast';
import { UnreadProvider } from '@hooks/useUnreadCounts';
import { CrashScreen } from '@pages/CrashScreen';
import App from './App';
import './index.css';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashScreen />}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <UnreadProvider>
              <App />
            </UnreadProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);

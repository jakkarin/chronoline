import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TermsPrivacyModal } from '@/components/terms-privacy-modal';

const Dashboard = lazy(() => import('./routes/dashboard'));
const TimelineEditor = lazy(() => import('./routes/timeline-editor'));
const NotFound = lazy(() => import('./routes/not-found'));

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-muted-foreground">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/timeline/:id" element={<TimelineEditor />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
      <TermsPrivacyModal showTrigger />
    </ThemeProvider>
  );
}

export default App;

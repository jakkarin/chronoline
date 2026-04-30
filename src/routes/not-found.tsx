import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <p className="text-4xl font-bold text-muted-foreground">404</p>
      <p className="text-lg font-semibold">Page not found</p>
      <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
    </div>
  );
}

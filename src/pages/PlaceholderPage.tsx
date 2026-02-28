import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const title = pathname.slice(1).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center gap-3">
          <Construction className="h-5 w-5 text-warning" />
          <CardTitle className="text-lg">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This module is under development. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

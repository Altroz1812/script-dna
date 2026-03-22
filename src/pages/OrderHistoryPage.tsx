import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Package, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState as useToggle } from 'react';

interface Order {
  id: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  status: string;
  cashfree_order_id: string | null;
  student_details: Record<string, { name: string; grade: string }[]>;
  coupon_code: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  paid: { label: 'Paid', variant: 'default', icon: CheckCircle2 },
  pending: { label: 'Pending', variant: 'secondary', icon: Clock },
  failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
};

export default function OrderHistoryPage() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data } = await (supabase
        .from('orders' as any)
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }) as any);
      setOrders((data as Order[]) || []);
      setLoading(false);
    })();
  }, [session?.user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order History</h1>
        <p className="text-muted-foreground">View your past enrollments and payment status</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-1">No orders yet</h2>
            <p className="text-muted-foreground text-sm">Your enrollment history will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const studentEntries = Object.entries(order.student_details || {});

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-5 w-5 ${order.status === 'paid' ? 'text-primary' : order.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div>
              <CardTitle className="text-base">
                Order #{order.id.slice(0, 8)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={config.variant}>{config.label}</Badge>
            <span className="font-bold text-foreground">₹{Number(order.final_amount).toLocaleString()}</span>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          <Separator />

          {studentEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Enrolled Students</p>
              {studentEntries.map(([courseId, students]) => (
                <div key={courseId} className="pl-3 border-l-2 border-muted">
                  <p className="text-xs text-muted-foreground mb-1">Course {courseId.slice(0, 8)}</p>
                  {(students as any[]).map((s: any, i: number) => (
                    <p key={i} className="text-sm text-foreground">{s.name} <span className="text-muted-foreground">· {s.grade}</span></p>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Subtotal</p>
              <p className="font-medium text-foreground">₹{Number(order.total_amount).toLocaleString()}</p>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div>
                <p className="text-muted-foreground text-xs">Discount</p>
                <p className="font-medium text-primary">-₹{Number(order.discount_amount).toLocaleString()}</p>
              </div>
            )}
            {order.coupon_code && (
              <div>
                <p className="text-muted-foreground text-xs">Coupon</p>
                <p className="font-medium text-foreground">{order.coupon_code}</p>
              </div>
            )}
            {order.cashfree_order_id && (
              <div>
                <p className="text-muted-foreground text-xs">Payment Ref</p>
                <p className="font-medium text-foreground text-xs">{order.cashfree_order_id}</p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

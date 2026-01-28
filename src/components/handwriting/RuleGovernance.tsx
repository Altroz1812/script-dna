import { useState, useEffect } from 'react';
import { Shield, ChevronRight, Sliders, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DiscoveredRule } from '@/types/handwriting';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function RuleGovernance() {
  const [rules, setRules] = useState<DiscoveredRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ tolerance: 5, weight: 1 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('discovered_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRules(data.map(rule => ({
        id: rule.id,
        ruleName: rule.rule_name,
        description: rule.description || '',
        patternType: rule.pattern_type,
        detectedValue: Number(rule.detected_value),
        toleranceMin: Number(rule.tolerance_min),
        toleranceMax: Number(rule.tolerance_max),
        impactWeight: Number(rule.impact_weight),
        status: rule.status as 'pending' | 'approved' | 'rejected',
        metadata: rule.metadata as object,
        createdAt: rule.created_at,
      })));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleUpdateRule = async (ruleId: string, updates: Partial<DiscoveredRule>) => {
    try {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const toleranceRange = editValues.tolerance;
      
      const { error } = await supabase
        .from('discovered_rules')
        .update({
          tolerance_min: rule.detectedValue - toleranceRange,
          tolerance_max: rule.detectedValue + toleranceRange,
          impact_weight: editValues.weight,
        })
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: "Rule Updated",
        description: "Changes have been saved.",
      });

      setEditingId(null);
      fetchRules();
    } catch (error) {
      console.error('Error updating rule:', error);
      toast({
        title: "Update Failed",
        description: "Could not update rule.",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (ruleId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('discovered_rules')
        .update({ status })
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: status === 'approved' ? "Rule Approved" : "Rule Rejected",
        description: `The rule has been ${status}.`,
      });

      fetchRules();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const pendingRules = rules.filter(r => r.status === 'pending');
  const activeRules = rules.filter(r => r.status === 'approved');

  return (
    <div className="panel-glass p-5 space-y-5">
      <div className="flex items-center gap-2 pb-4 border-b border-border/50">
        <Shield className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-semibold">Rule Governance</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {rules.length} total rules
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading rules...
        </div>
      ) : (
        <>
          {/* Pending Review */}
          {pendingRules.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-medium text-warning">Pending Review ({pendingRules.length})</h3>
              </div>
              {pendingRules.map((rule) => (
                <div key={rule.id} className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-foreground">{rule.ruleName}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                    </div>
                    <span className="status-badge status-pending">{rule.status}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange(rule.id, 'approved')}
                      className="bg-success hover:bg-success/90"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(rule.id, 'rejected')}
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Rules */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Active Rules ({activeRules.length})
            </h3>
            {activeRules.length > 0 ? (
              activeRules.map((rule) => (
                <div key={rule.id} className="rule-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">{rule.ruleName}</h4>
                        <span className="status-badge status-approved">{rule.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                      
                      <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Detected</span>
                          <div className="font-mono font-medium text-foreground">
                            {rule.detectedValue.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tolerance</span>
                          <div className="font-mono font-medium text-foreground">
                            ±{((rule.toleranceMax - rule.toleranceMin) / 2).toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Weight</span>
                          <div className="font-mono font-medium text-foreground">
                            {rule.impactWeight.toFixed(1)}x
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (editingId === rule.id) {
                          setEditingId(null);
                        } else {
                          setEditingId(rule.id);
                          setEditValues({
                            tolerance: (rule.toleranceMax - rule.toleranceMin) / 2,
                            weight: rule.impactWeight,
                          });
                        }
                      }}
                    >
                      <Sliders className="w-4 h-4" />
                    </Button>
                  </div>

                  {editingId === rule.id && (
                    <div className="mt-4 pt-4 border-t border-border/30 space-y-4 animate-fade-in">
                      <div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-muted-foreground">Tolerance Range</span>
                          <span className="font-mono text-foreground">±{editValues.tolerance.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[editValues.tolerance]}
                          onValueChange={([v]) => setEditValues(prev => ({ ...prev, tolerance: v }))}
                          min={0.5}
                          max={30}
                          step={0.5}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-muted-foreground">Impact Weight</span>
                          <span className="font-mono text-foreground">{editValues.weight.toFixed(1)}x</span>
                        </div>
                        <Slider
                          value={[editValues.weight]}
                          onValueChange={([v]) => setEditValues(prev => ({ ...prev, weight: v }))}
                          min={0.1}
                          max={5}
                          step={0.1}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateRule(rule.id, {})}
                          className="flex-1"
                        >
                          Save Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active rules yet</p>
                <p className="text-xs mt-1">Approve pending rules or record more patterns</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

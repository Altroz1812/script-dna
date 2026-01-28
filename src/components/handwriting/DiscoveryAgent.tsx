import { useState, useEffect } from 'react';
import { Brain, Lightbulb, Check, X, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { LiveMetrics, DiscoveredRule } from '@/types/handwriting';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DiscoveryAgentProps {
  metrics: LiveMetrics;
}

interface ProposedRule {
  ruleName: string;
  description: string;
  patternType: string;
  detectedValue: number;
  suggestedTolerance: number;
}

export function DiscoveryAgent({ metrics }: DiscoveryAgentProps) {
  const [proposedRules, setProposedRules] = useState<ProposedRule[]>([]);
  const [editingRule, setEditingRule] = useState<ProposedRule | null>(null);
  const [tolerance, setTolerance] = useState(5);
  const [impactWeight, setImpactWeight] = useState(1);
  const [savedRules, setSavedRules] = useState<DiscoveredRule[]>([]);

  // Discover patterns from metrics
  useEffect(() => {
    const newRules: ProposedRule[] = [];

    // Detect consistent slant
    if (Math.abs(metrics.slantAngle) > 5 && metrics.strokeCount >= 3) {
      newRules.push({
        ruleName: `Consistent ${metrics.slantAngle > 0 ? 'Right' : 'Left'} Slant Detected`,
        description: `Writing shows a consistent ${Math.abs(metrics.slantAngle).toFixed(1)}° ${metrics.slantAngle > 0 ? 'rightward' : 'leftward'} slant. This may indicate emotional expressiveness.`,
        patternType: 'slant_angle',
        detectedValue: metrics.slantAngle,
        suggestedTolerance: 5,
      });
    }

    // Detect pressure consistency
    if (metrics.pressureVariance < 0.1 && metrics.totalPoints > 50) {
      newRules.push({
        ruleName: 'Consistent Pressure Pattern',
        description: 'Low pressure variance indicates controlled, steady writing style.',
        patternType: 'pressure_consistency',
        detectedValue: metrics.pressureVariance,
        suggestedTolerance: 0.05,
      });
    } else if (metrics.pressureVariance > 0.25 && metrics.totalPoints > 50) {
      newRules.push({
        ruleName: 'Dynamic Pressure Variation',
        description: 'High pressure variance suggests expressive, emotionally-driven writing.',
        patternType: 'pressure_variation',
        detectedValue: metrics.pressureVariance,
        suggestedTolerance: 0.1,
      });
    }

    // Detect writing speed
    if (metrics.avgVelocity > 2 && metrics.strokeCount >= 3) {
      newRules.push({
        ruleName: 'Fast Writing Speed Detected',
        description: 'High velocity writing may indicate quick thinking or impatience.',
        patternType: 'velocity_high',
        detectedValue: metrics.avgVelocity,
        suggestedTolerance: 0.5,
      });
    }

    setProposedRules(newRules);
  }, [metrics]);

  // Fetch existing rules
  useEffect(() => {
    const fetchRules = async () => {
      const { data, error } = await supabase
        .from('discovered_rules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setSavedRules(data.map(rule => ({
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
    };

    fetchRules();
  }, []);

  const handleApproveRule = async (rule: ProposedRule) => {
    try {
      const { error } = await supabase
        .from('discovered_rules')
        .insert({
          rule_name: rule.ruleName,
          description: rule.description,
          pattern_type: rule.patternType,
          detected_value: rule.detectedValue,
          tolerance_min: rule.detectedValue - tolerance,
          tolerance_max: rule.detectedValue + tolerance,
          impact_weight: impactWeight,
          status: 'approved',
          metadata: { source: 'discovery_agent', approved_at: new Date().toISOString() },
        });

      if (error) throw error;

      toast({
        title: "Rule Approved",
        description: `"${rule.ruleName}" has been added to your ruleset.`,
      });

      setProposedRules(prev => prev.filter(r => r.ruleName !== rule.ruleName));
      setEditingRule(null);
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: "Error",
        description: "Could not save rule. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRejectRule = (rule: ProposedRule) => {
    setProposedRules(prev => prev.filter(r => r.ruleName !== rule.ruleName));
    toast({
      title: "Rule Dismissed",
      description: "The proposed rule has been dismissed.",
    });
  };

  return (
    <div className="panel-glass p-4 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Brain className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Discovery Agent</h3>
        {proposedRules.length > 0 && (
          <span className="ml-auto px-2 py-0.5 bg-primary/20 text-primary text-xs font-medium rounded-full">
            {proposedRules.length} New
          </span>
        )}
      </div>

      {/* Proposed Rules */}
      {proposedRules.length > 0 ? (
        <div className="space-y-3">
          {proposedRules.map((rule) => (
            <div key={rule.ruleName} className="rule-card animate-slide-in">
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-warning mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-foreground">{rule.ruleName}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                </div>
              </div>

              {editingRule?.ruleName === rule.ruleName ? (
                <div className="mt-3 space-y-3 pt-3 border-t border-border/30">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Tolerance Range</span>
                      <span className="font-mono text-foreground">±{tolerance}</span>
                    </div>
                    <Slider
                      value={[tolerance]}
                      onValueChange={([v]) => setTolerance(v)}
                      min={1}
                      max={20}
                      step={1}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Impact Weight</span>
                      <span className="font-mono text-foreground">{impactWeight.toFixed(1)}x</span>
                    </div>
                    <Slider
                      value={[impactWeight]}
                      onValueChange={([v]) => setImpactWeight(v)}
                      min={0.1}
                      max={3}
                      step={0.1}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproveRule(rule)}
                      className="flex-1 bg-success hover:bg-success/90"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingRule(null)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingRule(rule);
                      setTolerance(rule.suggestedTolerance);
                    }}
                    className="flex-1"
                  >
                    <Sliders className="w-3 h-3 mr-1" />
                    Configure
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRejectRule(rule)}
                    className="text-destructive hover:bg-destructive/20"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Keep writing to discover patterns</p>
          <p className="text-xs mt-1">Need at least 3 strokes</p>
        </div>
      )}

      {/* Recent Rules */}
      {savedRules.length > 0 && (
        <div className="pt-4 border-t border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Recent Rules
          </h4>
          <div className="space-y-2">
            {savedRules.slice(0, 3).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded-lg">
                <span className="text-xs text-foreground truncate">{rule.ruleName}</span>
                <span className={cn(
                  "status-badge",
                  rule.status === 'pending' && "status-pending",
                  rule.status === 'approved' && "status-approved",
                  rule.status === 'rejected' && "status-rejected",
                )}>
                  {rule.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

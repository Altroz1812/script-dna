import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { adminQuery } from "@/services/api/adminService";
import { useRBAC } from "@/hooks/useRBAC";
import { readActiveOrgFromStorage } from "@/contexts/ActiveOrgContext";

interface ClassroomSetting {
  id: string;
  organization_id: string;
  batch_id: string | null;
  max_participants: number;
  active_speaker_gate: number;
  rolling_window_size: number;
  non_speaker_video_enabled: boolean;
  batches?: { id: string; batch_name: string; meeting_room: string | null } | null;
}

interface BatchOption {
  id: string;
  batch_name: string;
}

const DEFAULTS = {
  max_participants: 400,
  active_speaker_gate: 12,
  rolling_window_size: 6,
  non_speaker_video_enabled: false,
};

export default function ClassroomSettingsPage() {
  const { isAdmin, isSuperAdmin, loading: rbacLoading } = useRBAC();
  const orgId = readActiveOrgFromStorage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ClassroomSetting[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);

  // Form state
  const [scope, setScope] = useState<"org" | "batch">("org");
  const [batchId, setBatchId] = useState<string>("");
  const [maxParticipants, setMaxParticipants] = useState(DEFAULTS.max_participants);
  const [gate, setGate] = useState(DEFAULTS.active_speaker_gate);
  const [windowSize, setWindowSize] = useState(DEFAULTS.rolling_window_size);
  const [nonSpeakerVideo, setNonSpeakerVideo] = useState(DEFAULTS.non_speaker_video_enabled);

  const canManage = isSuperAdmin || isAdmin;

  const load = async () => {
    if (!orgId && !isSuperAdmin) return;
    setLoading(true);
    try {
      const [settings, batchList] = await Promise.all([
        adminQuery("list_classroom_settings", {}),
        adminQuery("list_batches", {}),
      ]);
      setRows(Array.isArray(settings) ? settings : []);
      setBatches(
        (batchList ?? []).map((b: any) => ({ id: b.id, batch_name: b.batch_name ?? b.name ?? "Batch" })),
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to load classroom settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rbacLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rbacLoading, orgId]);

  const orgRow = useMemo(() => rows.find((r) => r.batch_id === null), [rows]);
  const batchRows = useMemo(() => rows.filter((r) => r.batch_id), [rows]);

  // Hydrate form when scope/batch changes
  useEffect(() => {
    const source: ClassroomSetting | undefined =
      scope === "org" ? orgRow : batchId ? rows.find((r) => r.batch_id === batchId) : undefined;
    if (source) {
      setMaxParticipants(source.max_participants);
      setGate(source.active_speaker_gate);
      setWindowSize(source.rolling_window_size);
      setNonSpeakerVideo(source.non_speaker_video_enabled);
    } else {
      setMaxParticipants(orgRow?.max_participants ?? DEFAULTS.max_participants);
      setGate(orgRow?.active_speaker_gate ?? DEFAULTS.active_speaker_gate);
      setWindowSize(orgRow?.rolling_window_size ?? DEFAULTS.rolling_window_size);
      setNonSpeakerVideo(orgRow?.non_speaker_video_enabled ?? DEFAULTS.non_speaker_video_enabled);
    }
  }, [scope, batchId, orgRow, rows]);

  const handleSave = async () => {
    if (scope === "batch" && !batchId) {
      toast.error("Select a batch to override");
      return;
    }
    setSaving(true);
    try {
      await adminQuery("upsert_classroom_settings", {
        batch_id: scope === "batch" ? batchId : null,
        max_participants: maxParticipants,
        active_speaker_gate: gate,
        rolling_window_size: windowSize,
        non_speaker_video_enabled: nonSpeakerVideo,
      });
      toast.success("Classroom settings saved");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this override?")) return;
    try {
      await adminQuery("delete_classroom_settings", { id });
      toast.success("Removed");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  if (rbacLoading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!canManage) {
    return <div className="p-8 text-muted-foreground">You don't have permission to manage classroom settings.</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="h-6 w-6" /> Live Classroom Settings</h1>
        <p className="text-sm text-muted-foreground">
          Tune the active-speaker gate and participant caps per organization, with optional per-batch overrides.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Org-level settings apply to every batch; batch-level overrides take precedence for that single room.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "org" | "batch")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">Organization-wide default</SelectItem>
                  <SelectItem value="batch">Per-batch override</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "batch" && (
              <div className="space-y-1.5">
                <Label>Batch</Label>
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.batch_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="max">Participant cutoff (max)</Label>
              <Input
                id="max"
                type="number" min={2} max={500}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Hard cap 500. Default 400.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gate">Active-speaker gate (participants)</Label>
              <Input
                id="gate"
                type="number" min={2} max={500}
                value={gate}
                onChange={(e) => setGate(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Switch to speaker-only video above this count. Default 12.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="win">Rolling window (recent speakers)</Label>
              <Input
                id="win"
                type="number" min={1} max={50}
                value={windowSize}
                onChange={(e) => setWindowSize(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Number of recent speakers kept visible. Default 6.</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="non" className="text-sm">Keep non-speaker video on in large rooms</Label>
              <p className="text-xs text-muted-foreground">
                Disables the speaker-only gate (uses more bandwidth/CPU). Off by default.
              </p>
            </div>
            <Switch id="non" checked={nonSpeakerVideo} onCheckedChange={setNonSpeakerVideo} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active overrides</CardTitle>
          <CardDescription>Per-batch overrides currently configured.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : batchRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No per-batch overrides yet.</p>
          ) : (
            <ul className="space-y-2">
              {batchRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm">{r.batches?.batch_name ?? r.batch_id}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                      <Badge variant="secondary">max {r.max_participants}</Badge>
                      <Badge variant="secondary">gate {r.active_speaker_gate}</Badge>
                      <Badge variant="secondary">window {r.rolling_window_size}</Badge>
                      {r.non_speaker_video_enabled && <Badge>non-speaker video on</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from "react";
import { toast } from "sonner";
import { Settings, Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectName: string;
  setProjectName: (n: string) => void;
  onReset: () => void;
};

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  projectName,
  setProjectName,
  onReset,
}: Props) {
  const [confirm, setConfirm] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" /> Project settings
          </DialogTitle>
          <DialogDescription>Manage this project's name, info, and danger zone.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Project name
            </label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="mt-1 w-full bg-muted/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
            />
          </div>

          <div className="rounded-xl border border-border p-3 text-xs space-y-1 bg-muted/30">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Tech stack
            </p>
            <p>Tailwind CSS via CDN</p>
            <p>Vanilla JavaScript</p>
            <p>Hosted on Lovable Cloud</p>
          </div>

          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="size-4" /> Danger zone
            </div>
            <p className="text-xs text-muted-foreground">
              Resets the entire project: messages, versions, and the current build. Cannot be undone.
            </p>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder='Type "reset" to confirm'
              className="w-full bg-card rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 ring-destructive/30"
            />
            <button
              disabled={confirm.toLowerCase() !== "reset"}
              onClick={() => {
                onReset();
                setConfirm("");
                onOpenChange(false);
                toast.success("Project reset");
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-destructive text-destructive-foreground hover:scale-[1.01] transition disabled:opacity-40 disabled:scale-100"
            >
              <Trash2 className="size-3.5" /> Reset project
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

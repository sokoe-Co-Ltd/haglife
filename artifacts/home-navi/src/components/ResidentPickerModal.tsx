import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useListResidents } from "@workspace/api-client-react";
import { Search } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (residentId: number, residentName: string) => void;
};

export function ResidentPickerModal({ open, onClose, onSelect }: Props) {
  const { data: residents } = useListResidents();
  const [search, setSearch] = useState("");

  const active = (residents ?? []).filter((r) => !r.movedOutAt);
  const filtered = active.filter((r) => {
    if (!search) return true;
    const name = `${r.lastName}${r.firstName}`;
    const kana = `${r.lastNameKana ?? ""}${r.firstNameKana ?? ""}`;
    return name.includes(search) || kana.includes(search);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>利用者を選択</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前で検索..."
            className="pl-9"
          />
        </div>
        <div className="overflow-y-auto flex-1 -mx-2 px-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">該当する利用者がいません</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id, `${r.lastName}${r.firstName}`)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-bold text-gray-800">
                    {r.lastName}{r.firstName}
                  </span>
                  {r.roomNumber && (
                    <span className="text-xs text-gray-400 ml-2">{r.roomNumber}号室</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

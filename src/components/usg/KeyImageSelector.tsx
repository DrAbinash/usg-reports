'use client';

import { useMemo } from 'react';
import { ImageIcon, CheckCircle2, Medal, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUsgStore } from '@/store/usg-store';

export default function KeyImageSelector() {
  const selectedStudy = useUsgStore((s) => s.selectedStudy);
  const approveKeyImage = useUsgStore((s) => s.approveKeyImage);

  const keyImages = useMemo(() => {
    const images = selectedStudy?.keyImages;
    if (!images) return [];
    return [...images].sort((a, b) => a.rank - b.rank);
  }, [selectedStudy]);

  const approvedCount = useMemo(
    () => keyImages.filter((k) => k.isApproved).length,
    [keyImages]
  );

  const allApproved = keyImages.length > 0 && approvedCount === keyImages.length;

  const handleApproveAll = () => {
    keyImages.forEach((img) => {
      if (!img.isApproved) approveKeyImage(img.id);
    });
  };

  if (!selectedStudy) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Select a study to view key images.
      </div>
    );
  }

  if (keyImages.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-7 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
            <ImageIcon className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              Key Images
            </h3>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex items-center justify-center size-10 rounded-full bg-slate-100 mb-2">
            <ImageIcon className="size-5 text-slate-400" />
          </div>
          <p className="text-sm text-muted-foreground">
            No key images proposed yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-7 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
            <ImageIcon className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              Key Images
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {approvedCount} of {keyImages.length} approved
            </p>
          </div>
        </div>
        {!allApproved && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={handleApproveAll}
          >
            <CheckCheck className="size-3" />
            Approve All
          </Button>
        )}
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
        {keyImages.map((img) => (
          <div
            key={img.id}
            className={`relative rounded-md border overflow-hidden transition-colors ${
              img.isApproved
                ? 'border-emerald-300 ring-1 ring-emerald-200'
                : 'border-border'
            }`}
          >
            {/* Thumbnail placeholder */}
            <div className="dicom-placeholder aspect-[4/3] bg-slate-800 flex items-center justify-center relative">
              <ImageIcon className="size-6 text-slate-500" />

              {/* Rank badge */}
              <div className="absolute top-1.5 left-1.5">
                <span className="inline-flex items-center gap-0.5 rounded bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5">
                  <Medal className="size-2.5" />
                  #{img.rank}
                </span>
              </div>

              {/* AI Score badge */}
              {img.aiScore !== undefined && (
                <div className="absolute bottom-1.5 right-1.5">
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4 px-1.5 bg-black/60 text-white border-0 hover:bg-black/60"
                  >
                    AI {(img.aiScore * 100).toFixed(0)}%
                  </Badge>
                </div>
              )}

              {/* Approved overlay */}
              {img.isApproved && (
                <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="size-8 text-emerald-400 drop-shadow" />
                </div>
              )}
            </div>

            {/* Label + action */}
            <div className="px-2 py-1.5 flex items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-foreground truncate">
                {img.category}
              </span>
              {img.isApproved ? (
                <Badge
                  variant="secondary"
                  className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0"
                >
                  Approved
                </Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                  onClick={() => approveKeyImage(img.id)}
                >
                  Approve
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
'use client';

import React, { useMemo } from 'react';
import { useUsgStore } from '@/store/usg-store';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  ScanLine,
  Baby,
  Heart,
  Activity,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle2,
  Stethoscope,
  Layers,
  CircleDot,
  Waypoints,
  ArrowDownUp,
} from 'lucide-react';
import type { DicomImage } from '@/lib/types';
import { cn } from '@/lib/utils';

function getQualityColor(score?: number) {
  if (score === undefined) return 'bg-gray-500';
  if (score > 0.9) return 'bg-emerald-500';
  if (score > 0.8) return 'bg-amber-500';
  return 'bg-orange-500';
}

function getIconClass(imageType?: string): string {
  const t = (imageType || '').toUpperCase();
  if (t.includes('DOPPLER') || t.includes('UA') || t.includes('MCA') || t.includes('UTA')) return 'doppler';
  if (t.includes('HEART') || t.includes('FHR') || t.includes('CARDIAC')) return 'heart';
  if (t.includes('BODY') || t.includes('ABDOMEN') || t.includes('AC')) return 'body';
  if (t.includes('SPINE')) return 'spine';
  if (t.includes('CERVIX')) return 'cervix';
  if (t.includes('PLACENTA')) return 'placenta';
  if (t.includes('BPD') || t.includes('HC') || t.includes('HEAD')) return 'head';
  if (t.includes('FL') || t.includes('FEMUR') || t.includes('HL')) return 'bone';
  return 'baby';
}

function ImageIcon({ type, className }: { type: string; className?: string }) {
  const cls = getIconClass(type);
  switch (cls) {
    case 'doppler': return <Activity className={className} />;
    case 'heart': return <Heart className={className} />;
    case 'body': return <Stethoscope className={className} />;
    case 'spine': return <Waypoints className={className} />;
    case 'cervix': return <ArrowDownUp className={className} />;
    case 'placenta': return <Layers className={className} />;
    case 'head': return <CircleDot className={className} />;
    case 'bone': return <ScanLine className={className} />;
    default: return <Baby className={className} />;
  }
}

interface FlattenedImage extends DicomImage {
  seriesDesc?: string;
  seriesNumber: number;
}

interface ThumbnailProps {
  image: FlattenedImage;
  isSelected: boolean;
  onClick: () => void;
}

function Thumbnail({ image, isSelected, onClick }: ThumbnailProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex-shrink-0 cursor-pointer transition-all duration-150',
        'w-[72px] h-[92px] rounded-md overflow-hidden',
        isSelected
          ? 'ring-2 ring-teal-500 ring-offset-1 ring-offset-background scale-105 z-10'
          : 'ring-1 ring-border hover:ring-teal-400/60'
      )}
      aria-label={`Image ${image.instanceNumber} - ${image.imageType || 'Unknown'}`}
    >
      {/* Quality bar */}
      <div className={cn('absolute top-0 left-0 right-0 h-[3px] z-20', getQualityColor(image.qualityScore))} />

      {/* Placeholder */}
      <div className="dicom-placeholder w-full h-full flex items-center justify-center">
        <ImageIcon type={image.imageType || ''} className="size-6 text-teal-400/60 relative z-10" />
      </div>

      {/* Key image star */}
      {image.isKeyImage && (
        <div className="absolute top-1 right-1 z-20">
          <Star className="size-3 fill-amber-400 text-amber-400 drop-shadow" />
        </div>
      )}

      {/* Approved checkmark */}
      {image.isApproved && (
        <div className="absolute bottom-1 right-1 z-20">
          <CheckCircle2 className="size-3 fill-emerald-500 text-white drop-shadow" />
        </div>
      )}

      {/* Label overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/70 px-1 py-0.5">
        <p className="text-[9px] text-white/90 truncate leading-tight font-medium">
          {image.imageType || `#${image.instanceNumber}`}
        </p>
        <p className="text-[7px] text-white/50 truncate leading-tight">
          {image.instanceNumber}
        </p>
      </div>
    </button>
  );
}

function MainViewer({ image, onPrev, onNext, canPrev, canNext }: {
  image: FlattenedImage | null;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  if (!image) {
    return (
      <div className="dicom-placeholder w-full h-full min-h-[200px] md:min-h-[350px] rounded-lg flex items-center justify-center">
        <p className="text-white/30 text-sm">No image selected</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border">
      {/* Main placeholder */}
      <div className="dicom-placeholder w-full min-h-[200px] md:min-h-[350px] flex items-center justify-center">
        <ImageIcon type={image.imageType || ''} className="size-16 text-teal-400/40 relative z-10" />
      </div>

      {/* Quality bar top */}
      <div className={cn('absolute top-0 left-0 right-0 h-1 z-20', getQualityColor(image.qualityScore))} />

      {/* Key image badge */}
      {image.isKeyImage && (
        <div className="absolute top-3 right-3 z-20">
          <Star className="size-5 fill-amber-400 text-amber-400 drop-shadow" />
        </div>
      )}

      {/* Approved badge */}
      {image.isApproved && (
        <div className="absolute top-3 left-3 z-20">
          <Badge className="bg-emerald-600 text-white border-0 gap-1 text-[10px]">
            <CheckCircle2 className="size-3" /> Approved
          </Badge>
        </div>
      )}

      {/* Overlay info panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 py-3">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            {image.imageType && (
              <Badge variant="secondary" className="w-fit text-[10px] bg-teal-700/80 text-teal-100 border-0">
                {image.imageType}
              </Badge>
            )}
            {image.aiLabel && (
              <p className="text-xs text-white/90 font-medium">{image.aiLabel}</p>
            )}
            {image.seriesDesc && (
              <p className="text-[10px] text-white/60">Series: {image.seriesDesc}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <p className="text-[10px] text-white/60">
              Instance #{image.instanceNumber} &middot; Series {image.seriesNumber}
            </p>
            {image.qualityScore !== undefined && (
              <p className={cn(
                'text-[10px] font-medium',
                image.qualityScore > 0.9 ? 'text-emerald-400' :
                image.qualityScore > 0.8 ? 'text-amber-400' : 'text-orange-400'
              )}>
                Quality: {(image.qualityScore * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {canPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="size-5 text-white" />
        </button>
      )}
      {canNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="size-5 text-white" />
        </button>
      )}
    </div>
  );
}

export default function ImageStrip() {
  const selectedStudy = useUsgStore((s) => s.selectedStudy);
  const selectedImageIndex = useUsgStore((s) => s.selectedImageIndex);
  const setSelectedImageIndex = useUsgStore((s) => s.setSelectedImageIndex);

  const series = selectedStudy?.series;

  const allImages = useMemo<FlattenedImage[]>(() => {
    if (!series) return [];
    const flat: FlattenedImage[] = [];
    for (const s of series) {
      if (s.images) {
        for (const img of s.images) {
          flat.push({
            ...img,
            seriesDesc: s.seriesDesc,
            seriesNumber: s.seriesNumber,
          });
        }
      }
    }
    return flat;
  }, [series]);

  const currentImage = allImages[selectedImageIndex] ?? null;

  const handlePrev = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedImageIndex < allImages.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  if (!selectedStudy) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Thumbnail strip */}
      <div className="h-[100px]">
        <ScrollArea className="h-full w-full">
          <div className="flex gap-2 px-1 py-1" style={{ width: `${Math.max(allImages.length * 80, 100)}%` }}>
            {allImages.map((img, i) => (
              <Thumbnail
                key={img.id}
                image={img}
                isSelected={i === selectedImageIndex}
                onClick={() => setSelectedImageIndex(i)}
              />
            ))}
            {allImages.length === 0 && (
              <div className="flex items-center justify-center w-full text-muted-foreground text-xs">
                No images in this study
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Main viewer */}
      <MainViewer
        image={currentImage}
        onPrev={handlePrev}
        onNext={handleNext}
        canPrev={selectedImageIndex > 0}
        canNext={selectedImageIndex < allImages.length - 1}
      />
    </div>
  );
}
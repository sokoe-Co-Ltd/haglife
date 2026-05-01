import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface ResidentAvatarProps {
  resident: {
    id?: number;
    lastName: string;
    firstName?: string;
    gender?: string | null;
    photoUrl?: string | null;
  };
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  isBirthday?: boolean;
  isHospitalized?: boolean;
  allowUpload?: boolean;
}

const sizeConfig = {
  sm:  { container: "h-8 w-8",   text: "text-xs",  ring: "ring-2", icon: "h-3 w-3" },
  md:  { container: "h-10 w-10", text: "text-sm",  ring: "ring-2", icon: "h-4 w-4" },
  lg:  { container: "h-16 w-16", text: "text-2xl", ring: "ring-4", icon: "h-6 w-6" },
  xl:  { container: "h-24 w-24", text: "text-4xl", ring: "ring-4", icon: "h-8 w-8" },
};

function PhotoLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
        aria-label="閉じる"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[85vw] rounded-2xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

export function ResidentAvatar({
  resident,
  size = "md",
  className = "",
  isBirthday = false,
  isHospitalized = false,
  allowUpload = false,
}: ResidentAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const cfg = sizeConfig[size];

  const genderRing =
    resident.gender === "男性"
      ? `${cfg.ring} ring-blue-400`
      : `${cfg.ring} ring-red-400`;

  const bgColor = isHospitalized
    ? "bg-blue-100 text-blue-600"
    : isBirthday
    ? "bg-red-100 text-red-600"
    : "bg-primary/10 text-primary";

  const showPhoto = !!(resident.photoUrl && !imgError);
  const canUpload = allowUpload && !showPhoto && !!resident.id;
  const altText = `${resident.lastName}${resident.firstName ?? ""}様`;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !resident.id) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/residents/${resident.id}/photo`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("アップロード失敗");
      await queryClient.invalidateQueries();
    } catch (err) {
      console.error(err);
      alert("写真のアップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  function handleAvatarClick(e: React.MouseEvent) {
    if (showPhoto) {
      e.preventDefault();
      e.stopPropagation();
      setLightboxOpen(true);
    } else if (canUpload) {
      e.preventDefault();
      e.stopPropagation();
      fileInputRef.current?.click();
    }
  }

  return (
    <>
      {/* outer wrapper: relative+shrink-0, NO overflow-hidden so badge can peek out */}
      <div
        className={`${cfg.container} shrink-0 relative ${className} ${
          showPhoto ? "cursor-zoom-in" : canUpload ? "cursor-pointer" : ""
        }`}
        onClick={handleAvatarClick}
      >
        {/* inner circle: overflow-hidden + ring */}
        <div className={`w-full h-full rounded-full overflow-hidden ${genderRing}`}>
          {uploading ? (
            <div className={`w-full h-full flex items-center justify-center ${bgColor}`}>
              <Loader2 className={`${cfg.icon} animate-spin`} />
            </div>
          ) : showPhoto ? (
            <img
              src={resident.photoUrl!}
              alt={altText}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center font-bold ${cfg.text} ${bgColor}`}>
              {isBirthday && !isHospitalized ? "🎂" : resident.lastName.charAt(0)}
            </div>
          )}
        </div>

        {canUpload && !uploading && (
          <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-0.5 shadow-md border-2 border-white pointer-events-none">
            <Camera className={cfg.icon} />
          </div>
        )}
      </div>

      {canUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {lightboxOpen && showPhoto && (
        <PhotoLightbox
          src={resident.photoUrl!}
          alt={altText}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

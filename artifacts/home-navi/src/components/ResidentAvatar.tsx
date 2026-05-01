import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ResidentAvatarProps {
  resident: {
    lastName: string;
    firstName?: string;
    gender?: string | null;
    photoUrl?: string | null;
  };
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  isBirthday?: boolean;
  isHospitalized?: boolean;
}

const sizeConfig = {
  sm:  { container: "h-8 w-8",   text: "text-xs",  ring: "ring-2" },
  md:  { container: "h-10 w-10", text: "text-sm",  ring: "ring-2" },
  lg:  { container: "h-16 w-16", text: "text-2xl", ring: "ring-4" },
  xl:  { container: "h-24 w-24", text: "text-4xl", ring: "ring-4" },
};

function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
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
}: ResidentAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  const showPhoto = resident.photoUrl && !imgError;
  const altText = `${resident.lastName}${resident.firstName ?? ""}様`;

  return (
    <>
      <div
        className={`${cfg.container} rounded-full shrink-0 overflow-hidden ${genderRing} ${className} ${showPhoto ? "cursor-zoom-in" : ""}`}
        onClick={showPhoto ? (e) => { e.preventDefault(); e.stopPropagation(); setLightboxOpen(true); } : undefined}
      >
        {showPhoto ? (
          <img
            src={resident.photoUrl!}
            alt={altText}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={`w-full h-full rounded-full flex items-center justify-center font-bold ${cfg.text} ${bgColor}`}
          >
            {isBirthday && !isHospitalized ? "🎂" : resident.lastName.charAt(0)}
          </div>
        )}
      </div>

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

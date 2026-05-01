import { useState } from "react";

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

export function ResidentAvatar({
  resident,
  size = "md",
  className = "",
  isBirthday = false,
  isHospitalized = false,
}: ResidentAvatarProps) {
  const [imgError, setImgError] = useState(false);
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

  return (
    <div
      className={`${cfg.container} rounded-full shrink-0 overflow-hidden ${genderRing} ${className}`}
    >
      {showPhoto ? (
        <img
          src={resident.photoUrl!}
          alt={`${resident.lastName}${resident.firstName ?? ""}様`}
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
  );
}

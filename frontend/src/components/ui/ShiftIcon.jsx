import { CalendarOff, CloudSun, Moon, Sun, UserX } from "lucide-react";

export default function ShiftIcon({ icon, size = 16, className = "" }) {
  const iconNames = new Set(
    typeof icon === "string" ? icon.split(/\s+/) : [],
  );
  const iconProps = {
    size,
    strokeWidth: 2,
    className,
    "aria-hidden": true,
  };

  if (iconNames.has("fa-sun")) return <Sun {...iconProps} />;
  if (iconNames.has("fa-moon")) return <Moon {...iconProps} />;
  if (iconNames.has("fa-cloud-sun")) return <CloudSun {...iconProps} />;
  if (iconNames.has("fa-calendar-xmark")) {
    return <CalendarOff {...iconProps} />;
  }
  if (iconNames.has("fa-user-xmark")) return <UserX {...iconProps} />;

  const fontAwesomeIcon = [...iconNames]
    .filter((name) => name !== "fa-solid")
    .join(" ");

  return (
    <i
      className={`fa-solid ${fontAwesomeIcon} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-brand text-brand-ink ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-[62%]" fill="none">
        <path
          d="M4 16.5c3.4-5 7.6-7.5 12.4-7.5 3.9 0 7 1.7 9.6 5.1-2.6 3.4-5.7 5.1-9.6 5.1-1.4 0-2.8-.3-4.1-.8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M4 16.5c1.6 2.4 3.4 4.1 5.4 5.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="20.2" cy="13.6" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export const GridIcon = (p: IconProps) => <Icon {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></Icon>;
export const WaterIcon = (p: IconProps) => <Icon {...p}><path d="M12 3s6 6.1 6 11a6 6 0 0 1-12 0c0-4.9 6-11 6-11Z" /><path d="M9 15.5c.5 1.2 1.5 1.8 3 1.8" /></Icon>;
export const WavesIcon = (p: IconProps) => <Icon {...p}><path d="M2 8c2 0 2-1.5 4-1.5S8 8 10 8s2-1.5 4-1.5S16 8 18 8s2-1.5 4-1.5" /><path d="M2 13c2 0 2-1.5 4-1.5S8 13 10 13s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /><path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /></Icon>;
export const ClipboardIcon = (p: IconProps) => <Icon {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 11h6M9 15h4" /></Icon>;
export const UploadIcon = (p: IconProps) => <Icon {...p}><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></Icon>;
export const DownloadIcon = (p: IconProps) => <Icon {...p}><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></Icon>;
export const PackageIcon = (p: IconProps) => <Icon {...p}><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4M12 11v10" /></Icon>;
export const SettingsIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Icon>;
export const FeedIcon = (p: IconProps) => <Icon {...p}><path d="M7 4h10l2 5-2 11H7L5 9l2-5Z" /><path d="M5 9h14M9 13h6" /></Icon>;
export const FishIcon = (p: IconProps) => <Icon {...p}><path d="M18 12c-2.2-3-5-4.5-8.5-4.5C6 7.5 3.5 9 2 12c1.5 3 4 4.5 7.5 4.5S15.8 15 18 12Z" /><path d="m18 12 4-4v8l-4-4Z" /><circle cx="7" cy="11" r=".6" fill="currentColor" stroke="none" /></Icon>;
export const ScaleIcon = (p: IconProps) => <Icon {...p}><path d="M6 20h12M12 3v17M5 7h14M5 7l-3 6h6L5 7ZM19 7l-3 6h6l-3-6Z" /></Icon>;
export const CoinsIcon = (p: IconProps) => <Icon {...p}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.6-2.4-2.9-5.5-3" /></Icon>;
export const SkullIcon = (p: IconProps) => <Icon {...p}><path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3Z" /><circle cx="9" cy="11" r="1.5" /><circle cx="15" cy="11" r="1.5" /><path d="M10 20v-2M14 20v-2" /></Icon>;
export const CalendarIcon = (p: IconProps) => <Icon {...p}><path d="M7 3v3M17 3v3M4 9h16" /><rect x="4" y="5" width="16" height="16" rx="2" /></Icon>;
export const ChartIcon = (p: IconProps) => <Icon {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon>;
export const TrendUpIcon = (p: IconProps) => <Icon {...p}><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></Icon>;
export const TrendDownIcon = (p: IconProps) => <Icon {...p}><path d="m3 7 6 6 4-4 8 8" /><path d="M15 17h6v-6" /></Icon>;
export const AlertIcon = (p: IconProps) => <Icon {...p}><path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4M12 17h.01" /></Icon>;
export const InfoIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m5 12 4 4L19 6" /></Icon>;
export const CheckCircleIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icon>;
export const CircleIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></Icon>;
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="m15 6-6 6 6 6" /></Icon>;
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const ArrowRightIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ArrowLeftIcon = (p: IconProps) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const MinusIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14" /></Icon>;
export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Icon>;
export const PencilIcon = (p: IconProps) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></Icon>;
export const LogoutIcon = (p: IconProps) => <Icon {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></Icon>;
export const FileIcon = (p: IconProps) => <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Icon>;
export const SparkleIcon = (p: IconProps) => <Icon {...p}><path d="M12 3c.5 4.3 2.7 6.5 7 7-4.3.5-6.5 2.7-7 7-.5-4.3-2.7-6.5-7-7 4.3-.5 6.5-2.7 7-7Z" /><path d="M19 16c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3Z" /></Icon>;
export const UserIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Icon>;
export const ClockIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const XIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const MenuIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
export const GlobeIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></Icon>;
export const HarvestIcon = (p: IconProps) => <Icon {...p}><path d="M3 10h18l-2 9a2 2 0 0 1-2 1.6H7A2 2 0 0 1 5 19l-2-9Z" /><path d="M8 10c0-2.2 1.8-4 4-4s4 1.8 4 4M7 6.5 9 4M17 6.5 15 4" /></Icon>;
export const MapIcon = (p: IconProps) => <Icon {...p}><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14M15 6v14" /></Icon>;
export const HeartPulseIcon = (p: IconProps) => <Icon {...p}><path d="M20.8 8.6A5 5 0 0 0 12 5.5a5 5 0 0 0-8.8 3.1C3.2 13.4 12 20 12 20s8.8-6.6 8.8-11.4Z" /><path d="M3.5 12h4l1.5-3 3 6 1.5-3h7" /></Icon>;
export const RulerIcon = (p: IconProps) => <Icon {...p}><rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M6 8v3M10 8v4M14 8v3M18 8v4" /></Icon>;
export const BoxIcon = (p: IconProps) => <Icon {...p}><path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" /><path d="M3 8l2-4h14l2 4M10 12h4" /></Icon>;

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Clock3,
  FileText,
  House,
  LayoutGrid,
  Columns3,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Search,
  X,
  Download,
  Users,
} from "lucide-react";

const icons = {
  grid: LayoutGrid,
  users: Users,
  home: House,
  board: Columns3,
  file: FileText,
  check: CircleCheck,
  settings: SlidersHorizontal,
  arrow: ArrowRight,
  back: ArrowLeft,
  plus: Plus,
  clock: Clock3,
  calendar: CalendarDays,
  refresh: RefreshCw,
  search: Search,
  close: X,
  download: Download,
};

export default function Icon({ name, className = "" }) {
  const LucideIcon = icons[name];
  return (
    <LucideIcon
      className={`ui-icon ${className}`}
      size={18}
      strokeWidth={1.7}
      aria-hidden="true"
    />
  );
}

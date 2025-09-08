import {
  ChartBar,
  Banknote,
  type LucideIcon,
  HomeIcon,
  Users2Icon,
  GroupIcon,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        title: "Home",
        url: "/dashboard/default",
        icon: HomeIcon,
      },
      {
        title: "Members",
        url: "/dashboard/members",
        icon: Users2Icon,
      },
      {
        title: "TeamInfo",
        url: "/dashboard/team-info",
        icon: GroupIcon,
      }
    ],
  }
];

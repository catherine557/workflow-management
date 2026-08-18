export const SHEET_SOURCE_URL =
  "https://docs.google.com/spreadsheets/d/1Yyo0l90Go6tdNM4SCZ9f1CI7XMiEegec3htUkzsA6wo/edit?gid=0#gid=0";

export const SIB_FACTORY_SOURCE_URL =
  "https://github.com/shellysbistro/shellys-rte-command-centre/blob/main/MASTER_BUILD_PROMPT.md";

export const GOOGLE_AUTHORIZED_EMAIL = "catherine@yensbooks.com";

export const DEFAULT_DASHBOARD_ADMIN_EMAILS = [
  "richardc@yensbooks.com",
  "richardc@shellysbistro.com",
  "scrum@aimadvisors.ca",
  "catherine@aimadvisors.ca",
] as const;

export type CompanyId =
  | "all"
  | "audit-expert"
  | "yens-and-santos"
  | "aima"
  | "shellys-bistro";

export type Company = {
  id: CompanyId;
  name: string;
  shortName: string;
  logo: string | null;
  accent: string;
  accentStrong: string;
  soft: string;
  nav: string;
};

export const companies: Company[] = [
  {
    id: "all",
    name: "All Companies",
    shortName: "All Companies",
    logo: null,
    accent: "#5966db",
    accentStrong: "#414db8",
    soft: "#f0f2ff",
    nav: "#20253a",
  },
  {
    id: "audit-expert",
    name: "Audit Expert",
    shortName: "Audit Expert",
    logo: "/company-logos/audit-expert.png",
    accent: "#e85815",
    accentStrong: "#b63c06",
    soft: "#fff2e9",
    nav: "#253343",
  },
  {
    id: "yens-and-santos",
    name: "Yens and Santos",
    shortName: "Yens & Santos",
    logo: "/company-logos/yens-and-santos.png",
    accent: "#b98619",
    accentStrong: "#76520b",
    soft: "#fff7df",
    nav: "#092f52",
  },
  {
    id: "aima",
    name: "Accurate Indigenous Managers and Advisors (AIMA)",
    shortName: "AIMA",
    logo: "/company-logos/aima.png",
    accent: "#087d83",
    accentStrong: "#075b61",
    soft: "#e8f7f6",
    nav: "#183b43",
  },
  {
    id: "shellys-bistro",
    name: "Shelly's Bistro",
    shortName: "Shelly's Bistro",
    logo: "/company-logos/shellys-bistro.png",
    accent: "#b33f8d",
    accentStrong: "#7d245f",
    soft: "#fcecf7",
    nav: "#48213f",
  },
];

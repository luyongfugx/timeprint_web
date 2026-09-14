import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Timeprint",
  version: packageJson.version,
  copyright: `© ${currentYear}, Timeprint.`,
  meta: {
    title: "Timeprint - Timeprint Camera",
    description: "Timeprint  Camera.",
  },
};

import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Timeprint Group",
  version: packageJson.version,
  copyright: `© ${currentYear}, Timeprint Group.`,
  meta: {
    title: "Timeprint Group - Timeprint Camera",
    description:
      "Timeprint  Camera.",
  },
};

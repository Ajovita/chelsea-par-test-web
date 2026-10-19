// Shared enquiry values keep package buttons, the form and API in sync.
export const packageNames = {
  rain: "RAIN — Social Content Creation",
  freeze: "FREEZE — Photography",
  ice: "ICE — Videography",
  glacier: "GLACIER — Photo + Video",
  everest: "EVEREST — Photo + Video + Content",
} as const;

export const packageChoices = Object.values(packageNames);

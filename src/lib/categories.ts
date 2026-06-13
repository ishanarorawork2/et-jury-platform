// Complete, human-readable names for the 22 canonical category keys
// (nominations.category_key / category_mapping.normalized_key).
// Source of truth: the readable raw_labels in category_mapping. Used everywhere
// a sub-category is displayed so jurors/admins see "ET CISO of the Year" rather
// than the machine key "et_ciso".

export const CATEGORY_LABELS: Record<string, string> = {
  // Individual Leadership
  et_ciso: 'ET CISO of the Year',
  et_cyberwoman: 'ET Cyber Woman of the Year',
  et_dpo: 'ET DPO of the Year',
  et_rising_star: 'ET Rising Star of the Year',
  et_lifetime_achievement: 'ET Lifetime Achievement Award',
  et_cybersecurity_influencer: 'ET Cybersecurity Influencer of the Year',

  // Organisational Excellence
  bfsi: 'BFSI',
  itites: 'IT/ITeS',
  manufacturing: 'Manufacturing',
  healthcare_pharma: 'Healthcare, Pharma & Life Sciences',
  retail_fmcg: 'Retail + FMCG + F&B Retail',
  generic_all_sectors: 'Generic / All Sectors',

  // Project & Technology Excellence
  ai_security_responsible_ai: 'AI Security & Responsible AI Governance',
  identity_access_management: 'Identity & Access Management',
  zero_trust_architecture: 'Zero Trust Architecture',
  cloud_security_champion: 'Cloud Security Champion',
  edrxdr_implementation: 'EDR/XDR Implementation',
  shift_left_devsecops: 'Shift-Left Security & DevSecOps',
  ot_security: 'OT Security',
  soc_maturity_ransomware: 'SOC Maturity & Ransomware Resilience',
  data_protection_privacy: 'Data Protection & Privacy',
  endpoint_security: 'Endpoint Security',
}

// Returns the complete readable name for a category key, falling back to the
// raw key if it is unknown (e.g. a new category added to category_mapping).
export function categoryLabel(key: string | null | undefined): string {
  if (!key) return ''
  return CATEGORY_LABELS[key] ?? key
}

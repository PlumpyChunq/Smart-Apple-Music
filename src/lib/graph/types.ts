import type { ArtistNode, ArtistRelationship } from '@/types';

// Expansion depth options
export type ExpansionDepth = 1 | 2 | 3 | 4;

export const expansionDepthLabels: Record<ExpansionDepth, string> = {
  1: 'Level 1 - Direct connections only',
  2: 'Level 2 - Include members\' other bands',
  3: 'Level 3 - Two degrees of separation',
  4: 'Level 4 - Three degrees (large graph)',
};

// Labels for when viewing a band/group
export const relationshipLabelsForGroup: Record<string, string> = {
  member_of: 'Members',
  founder_of: 'Founders',
  side_project: 'Side Projects',
  collaboration: 'Collaborations',
  producer: 'Producers',
  influenced_by: 'Influences',
  same_scene: 'Same Scene',
  same_label: 'Same Label',
  touring_member: 'Touring Members',
};

// Labels for when viewing a person
export const relationshipLabelsForPerson: Record<string, string> = {
  member_of: 'Bands & Groups',
  founder_of: 'Founded',
  side_project: 'Side Projects',
  collaboration: 'Collaborations',
  producer: 'Produced',
  influenced_by: 'Influences',
  same_scene: 'Same Scene',
  same_label: 'Same Label',
  touring_member: 'Touring For',
};

// Get appropriate labels based on artist type
export function getRelationshipLabel(type: string, artistType: string): string {
  const labels = artistType === 'person' ? relationshipLabelsForPerson : relationshipLabelsForGroup;
  return labels[type] || type;
}

export interface GroupedItem {
  relationship: ArtistRelationship;
  artist: ArtistNode;
  isFoundingMember: boolean;
  isCurrent: boolean;
  tenure: string;
  sortYear: number;
}

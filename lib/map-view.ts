import type { Place } from './places';
import { referenceBoundaries, type SchoolResult } from './schools';

export type SchoolMapViewProps = {
  schools: SchoolResult[];
  selectedId?: string;
  onSelect: (id: string) => void;
  center: Place | null;
  radiusKm: number | null;
  boundaries: ReturnType<typeof referenceBoundaries>;
  highlightedStreet: string;
};

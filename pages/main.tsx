import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/globals.css';
import LeafletSchoolMap from '@/components/leaflet-school-map';
import SchoolMap from '@/components/school-map';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SchoolMap map={LeafletSchoolMap} />
  </StrictMode>,
);

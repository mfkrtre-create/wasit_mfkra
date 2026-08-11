import { useEffect } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { AppProvider, useApp } from '@/ui/context/AppContext';
import { Layout } from '@/ui/components/Layout';
import { Dashboard } from '@/ui/pages/Dashboard';
import { ListingsPage } from '@/ui/pages/ListingsPage';
import { MapPage } from '@/ui/pages/MapPage';
import { ContactsPage } from '@/ui/pages/ContactsPage';
import { AccountPage } from '@/ui/pages/AccountPage';
import { AdminPage } from '@/ui/pages/AdminPage';
import { ListingDetails } from '@/ui/components/ListingDetails';
import { useDB } from '@/ui/lib/db';

/** Deep link /listing/:id → opens the details sheet on top of its module page */
function ListingDeepLink() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { listings } = useDB();
  const { setViewingListing } = useApp();

  useEffect(() => {
    const l = listings.find((x) => x.id === id);
    if (l) {
      setViewingListing(l);
      navigate(l.kind === 'offer' ? '/offers' : '/requests', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return null;
}

function AppInner() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="offers" element={<ListingsPage kind="offer" />} />
          <Route path="requests" element={<ListingsPage kind="request" />} />
          <Route path="map" element={<MapPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="listing/:id" element={<ListingDeepLink />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ListingDetails />
    </>
  );
}

export default function App() {
  return (
    <MemoryRouter>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </MemoryRouter>
  );
}

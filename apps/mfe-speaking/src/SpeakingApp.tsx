import { Route, Routes } from 'react-router-dom';
import { ApiProvider, type ApiFetch } from './model/api';
import { SpeakingScreen } from './ui/speaking-screen';

export default function SpeakingApp({
  api,
  accessToken,
}: {
  api: ApiFetch;
  accessToken: string;
}) {
  return (
    <ApiProvider api={api}>
      <Routes>
        <Route index element={<SpeakingScreen accessToken={accessToken} />} />
      </Routes>
    </ApiProvider>
  );
}

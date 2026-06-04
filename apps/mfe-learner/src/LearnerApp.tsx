import { Route, Routes } from 'react-router-dom';
import { ApiProvider, type ApiFetch } from './model/api';
import { DecksScreen } from './ui/decks/decks-screen';
import { DeckDetailScreen } from './ui/deck-detail/deck-detail-screen';
import { ReviewScreen } from './ui/review/review-screen';

export default function LearnerApp({ api }: { api: ApiFetch }) {
  return (
    <ApiProvider api={api}>
      <Routes>
        <Route index element={<DecksScreen />} />
        <Route path="decks/:deckId" element={<DeckDetailScreen />} />
        <Route path="review" element={<ReviewScreen />} />
      </Routes>
    </ApiProvider>
  );
}

export type MatchRow = {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_slug: string;
  created_at: string;
  expires_at: string;
  other_id: string;
  other_name: string;
  other_photo: string | null;
  other_public_key: JsonWebKey | null;
  i_shared: boolean;
  they_shared: boolean;
  messages_used: number;
  message_cap: number;
};

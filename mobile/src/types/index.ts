// IDs are UUID strings on the backend (Postgres + `uuid` package) — never numbers.
export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  last_seen: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  text: string;
  reaction: string | null;
  created_at: string;
  is_system: boolean;
  username: string;
  avatar: string | null;
  tempId?: string;
  pending?: boolean;
}

export interface Room {
  id: string;
  name: string;
  is_group: boolean;
  type: 'room' | 'channel' | 'private_channel';
  slug: string | null;
  description: string | null;
  created_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  other_user_id?: string;
  other_username?: string;
  other_avatar?: string | null;
  // Server returns `other_user_online` from GET /api/rooms.
  other_user_online?: boolean;
  is_new?: boolean;
  member_role?: 'owner' | 'admin' | 'moderator' | 'member';
  is_muted?: boolean;
}

export interface Contact {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  status: 'pending' | 'accepted' | 'none';
  last_seen: string;
  online?: boolean;
}

export interface RoomMember {
  id: string;
  username: string;
  avatar: string | null;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joined_at: string;
  muted_until: string | null;
  online?: boolean;
}

export interface PinnedMessage {
  id: string;
  message_id: string;
  room_id: string;
  pinned_by: string;
  pinned_at: string;
  text: string;
  username: string;
}

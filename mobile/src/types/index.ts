export interface User {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  last_seen: string;
}

export interface Message {
  id: number;
  room_id: number;
  user_id: number;
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
  id: number;
  name: string;
  is_group: boolean;
  type: 'room' | 'channel' | 'private_channel';
  slug: string | null;
  description: string | null;
  created_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  other_user_id?: number;
  other_username?: string;
  other_avatar?: string | null;
  other_online?: boolean;
  is_new?: boolean;
  member_role?: 'owner' | 'admin' | 'moderator' | 'member';
  is_muted?: boolean;
}

export interface Contact {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  status: 'pending' | 'accepted' | 'none';
  last_seen: string;
  online?: boolean;
}

export interface RoomMember {
  id: number;
  username: string;
  avatar: string | null;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joined_at: string;
  muted_until: string | null;
  online?: boolean;
}

export interface PinnedMessage {
  id: number;
  message_id: number;
  room_id: number;
  pinned_by: number;
  pinned_at: string;
  text: string;
  username: string;
}

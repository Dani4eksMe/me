import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  sender_id: string;
  created_at: string;
}

interface Chat {
  id: string;
  participants: Array<{
    id: string;
    username: string;
    avatar_url: string | null;
  }>;
  lastMessage?: Message;
}

interface ChatState {
  chats: Chat[];
  currentChat: Chat | null;
  messages: Message[];
  setCurrentChat: (chat: Chat | null) => void;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  createChat: (participantId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, file?: File) => Promise<void>;
  searchUsers: (query: string) => Promise<any[]>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChat: null,
  messages: [],

  setCurrentChat: (chat) => set({ currentChat: chat }),

  loadChats: async () => {
    const { data: chats } = await supabase
      .from('chats')
      .select(`
        id,
        chat_participants!inner(profile_id),
        messages(
          id,
          content,
          file_url,
          file_name,
          file_size,
          sender_id,
          created_at
        )
      `)
      .order('created_at', { foreignTable: 'messages', ascending: false })
      .limit(1, { foreignTable: 'messages' });

    if (chats) {
      const formattedChats = await Promise.all(
        chats.map(async (chat) => {
          const { data: participants } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in(
              'id',
              chat.chat_participants.map((p: any) => p.profile_id)
            );

          return {
            id: chat.id,
            participants: participants || [],
            lastMessage: chat.messages?.[0],
          };
        })
      );

      set({ chats: formattedChats });
    }
  },

  loadMessages: async (chatId: string) => {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messages) {
      set({ messages });
    }
  },

  createChat: async (participantId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: chat } = await supabase
      .from('chats')
      .insert({})
      .select()
      .single();

    if (chat) {
      await supabase.from('chat_participants').insert([
        { chat_id: chat.id, profile_id: user.id },
        { chat_id: chat.id, profile_id: participantId },
      ]);

      await get().loadChats();
    }
  },

  sendMessage: async (chatId: string, content: string, file?: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('message-files')
          .getPublicUrl(uploadData.path);

        fileUrl = publicUrl;
        fileName = file.name;
        fileSize = file.size;
      }
    }

    const { data: message } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
      })
      .select()
      .single();

    if (message) {
      set((state) => ({
        messages: [...state.messages, message],
      }));
    }
  },

  searchUsers: async (query: string) => {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${query}%`)
      .limit(10);

    return users || [];
  },
}));
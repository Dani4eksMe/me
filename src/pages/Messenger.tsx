import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Search, LogOut, Settings, Send, Plus, Paperclip, User } from 'lucide-react';
import { format } from 'date-fns';

export default function Messenger() {
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [newAvatar, setNewAvatar] = useState<File | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user, signOut, updateProfile } = useAuthStore();
  const {
    chats,
    currentChat,
    messages,
    loadChats,
    loadMessages,
    setCurrentChat,
    sendMessage,
    searchUsers,
    createChat,
  } = useChatStore();

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (currentChat) {
      loadMessages(currentChat.id);
    }
  }, [currentChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChat || (!message && !fileInputRef.current?.files?.[0])) return;

    const file = fileInputRef.current?.files?.[0];
    await sendMessage(currentChat.id, message, file);
    setMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = await searchUsers(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      if (newPassword) {
        // Handle password update through Supabase Auth
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (error) throw error;
      }

      if (newAvatar) {
        const fileExt = newAvatar.name.split('.').pop();
        const fileName = `${user?.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, newAvatar, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        await updateProfile({ avatar_url: publicUrl });
      }

      setShowSettings(false);
      setNewPassword('');
      setNewAvatar(null);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-50 border-r">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <span className="font-medium">{user?.username}</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-gray-200 rounded-full"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={signOut}
                  className="p-2 hover:bg-gray-200 rounded-full"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2 bg-white border rounded-lg"
              />
              <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
            <button
              onClick={() => setShowUserSearch(true)}
              className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-5 h-5" />
              <span>New Chat</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {chats.map((chat) => {
              const otherParticipant = chat.participants.find(p => p.id !== user?.id);
              return (
                <button
                  key={chat.id}
                  onClick={() => setCurrentChat(chat)}
                  className={`w-full p-4 flex items-center space-x-3 hover:bg-gray-100 ${
                    currentChat?.id === chat.id ? 'bg-gray-100' : ''
                  }`}
                >
                  {otherParticipant?.avatar_url ? (
                    <img
                      src={otherParticipant.avatar_url}
                      alt={otherParticipant.username}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {otherParticipant?.username}
                    </div>
                    {chat.lastMessage && (
                      <div className="text-sm text-gray-500 truncate">
                        {chat.lastMessage.content || chat.lastMessage.file_name}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center space-x-3">
                {currentChat.participants.find(p => p.id !== user?.id)?.avatar_url ? (
                  <img
                    src={currentChat.participants.find(p => p.id !== user?.id)?.avatar_url!}
                    alt={currentChat.participants.find(p => p.id !== user?.id)?.username}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <span className="font-medium">
                  {currentChat.participants.find(p => p.id !== user?.id)?.username}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 flex ${
                    message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.sender_id === user?.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100'
                    }`}
                  >
                    {message.content && <p>{message.content}</p>}
                    {message.file_url && (
                      <div className="mt-2">
                        <a
                          href={message.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-sm underline"
                        >
                          <Paperclip className="w-4 h-4" />
                          <span>{message.file_name}</span>
                        </a>
                      </div>
                    )}
                    <div className={`text-xs mt-1 ${
                      message.sender_id === user?.id ? 'text-indigo-200' : 'text-gray-500'
                    }`}>
                      {format(new Date(message.created_at), 'HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t">
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={() => {}}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <Paperclip className="w-5 h-5 text-gray-500" />
                </button>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat or start a new conversation
          </div>
        )}
      </div>

      {/* User Search Modal */}
      {showUserSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-semibold mb-4">New Chat</h2>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => handleSearch( e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
            />
            <div className="max-h-64 overflow-y-auto">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={async () => {
                    await createChat(user.id);
                    setShowUserSearch(false);
                    setSearchQuery('');
                  }}
                  className="w-full p-3 flex items-center space-x-3 hover:bg-gray-100 rounded-lg"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <span>{user.username}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowUserSearch(false);
                setSearchQuery('');
              }}
              className="mt-4 w-full px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewAvatar(e.target.files?.[0] || null)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Leave blank to keep current password"
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleUpdateProfile}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setNewPassword('');
                  setNewAvatar(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
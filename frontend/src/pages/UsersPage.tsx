import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, User as UserIcon, Shield, ShieldCheck, Warehouse, Check, X, Edit2, Key, Trash2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { usersService } from '../services/usersService';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';
import clsx from 'clsx';

const roleConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ADMIN: { label: 'Administrator', icon: <ShieldCheck className="w-4 h-4" />, color: 'text-red-400' },
  MANAGER: { label: 'Kierownik', icon: <Shield className="w-4 h-4" />, color: 'text-yellow-400' },
  WAREHOUSE: { label: 'Magazynier', icon: <Warehouse className="w-4 h-4" />, color: 'text-blue-400' },
};

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    phone: '',
    password: '',
    name: '',
    role: 'WAREHOUSE' as 'ADMIN' | 'MANAGER' | 'WAREHOUSE',
  });

  // Edit state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editData, setEditData] = useState({ name: '', role: 'WAREHOUSE' as string });

  // Reset password state
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Delete state
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getUsers({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: usersService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddForm(false);
      setNewUser({ phone: '', password: '', name: '', role: 'WAREHOUSE' });
      toast.success('Użytkownik utworzony');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd tworzenia użytkownika');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; role?: string } }) =>
      usersService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      toast.success('Użytkownik zaktualizowany');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd aktualizacji');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersService.resetPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowPassword(true);
      toast.success('Hasło zmienione');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd zmiany hasła');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersService.updateUser(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Status zmieniony');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersService.deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteUser(null);
      toast.success('Użytkownik dezaktywowany');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd usuwania');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.phone || !newUser.password || !newUser.name) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }
    createMutation.mutate(newUser);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditData({ name: user.name, role: user.role });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData.name.trim()) {
      toast.error('Imię nie może być puste');
      return;
    }
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: editData });
    }
  };

  const handleResetPassword = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setShowPassword(false);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Hasło musi mieć minimum 6 znaków');
      return;
    }
    if (resetPasswordUser) {
      resetPasswordMutation.mutate({ id: resetPasswordUser.id, password: newPassword });
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    toast.success('Hasło skopiowane');
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  return (
    <Layout
      title="Użytkownicy"
      actions={
        <Button
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          icon={<UserPlus className="w-4 h-4" />}
        >
          Dodaj
        </Button>
      }
    >
      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="glass-card p-4 mb-4 space-y-3 animate-fade-in">
          <h3 className="font-medium text-white mb-3">Nowy użytkownik</h3>
          <Input
            label="Imię i nazwisko"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            placeholder="Jan Kowalski"
          />
          <Input
            label="Numer telefonu"
            value={newUser.phone}
            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            placeholder="+48123456789"
          />
          <Input
            label="Hasło"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="Min. 6 znaków"
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Rola</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            >
              <option value="WAREHOUSE">Magazynier</option>
              <option value="MANAGER">Kierownik</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)} className="flex-1">
              Anuluj
            </Button>
            <Button type="submit" loading={createMutation.isPending} className="flex-1">
              Utwórz
            </Button>
          </div>
        </form>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveEdit} className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h3 className="font-medium text-white text-lg mb-4">Edytuj użytkownika</h3>
            <div className="space-y-3">
              <Input
                label="Imię i nazwisko"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                autoFocus
              />
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Rola</label>
                <select
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
                  disabled={editingUser.id === currentUser?.id}
                >
                  <option value="WAREHOUSE">Magazynier</option>
                  <option value="MANAGER">Kierownik</option>
                  <option value="ADMIN">Administrator</option>
                </select>
                {editingUser.id === currentUser?.id && (
                  <p className="text-xs text-slate-500 mt-1">Nie możesz zmienić własnej roli</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingUser(null)}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button type="submit" loading={updateMutation.isPending} className="flex-1">
                Zapisz
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h3 className="font-medium text-white text-lg mb-2">Zmień hasło</h3>
            <p className="text-slate-400 text-sm mb-4">
              Użytkownik: <span className="text-white">{resetPasswordUser.name}</span>
            </p>

            {showPassword ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-green-400 mb-2">Nowe hasło zostało ustawione:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-lg font-mono text-white bg-black/20 px-3 py-2 rounded-lg">
                      {newPassword}
                    </code>
                    <button
                      onClick={handleCopyPassword}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Kopiuj"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setResetPasswordUser(null);
                    setShowPassword(false);
                  }}
                  className="w-full"
                >
                  Zamknij
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSavePassword} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-slate-300">Nowe hasło</label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-xs text-primary-400 hover:text-primary-300"
                    >
                      Generuj
                    </button>
                  </div>
                  <Input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 znaków"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setResetPasswordUser(null)}
                    className="flex-1"
                  >
                    Anuluj
                  </Button>
                  <Button
                    type="submit"
                    loading={resetPasswordMutation.isPending}
                    className="flex-1"
                  >
                    Zmień hasło
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h3 className="font-medium text-white text-lg mb-2">Dezaktywuj użytkownika</h3>
            <p className="text-slate-400 mb-4">
              Czy na pewno chcesz dezaktywować użytkownika{' '}
              <span className="text-white font-medium">"{deleteUser.name}"</span>?
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteUser(null)}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => deleteMutation.mutate(deleteUser.id)}
                loading={deleteMutation.isPending}
                className="flex-1"
              >
                Dezaktywuj
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.data.map((user) => {
            const role = roleConfig[user.role];
            const isCurrentUser = user.id === currentUser?.id;
            return (
              <div
                key={user.id}
                className={clsx(
                  'glass-card p-4',
                  !user.isActive && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{user.name}</span>
                      {isCurrentUser && (
                        <span className="text-xs text-primary-400">(Ty)</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400">{user.phone}</div>
                  </div>
                  <div className={clsx('flex items-center gap-1 mr-2', role.color)}>
                    {role.icon}
                    <span className="text-xs hidden sm:inline">{role.label}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
                  <button
                    onClick={() => handleEdit(user)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edytuj</span>
                  </button>
                  <button
                    onClick={() => handleResetPassword(user)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors text-sm"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Hasło</span>
                  </button>
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm',
                      user.isActive
                        ? 'text-green-400 hover:bg-green-500/10'
                        : 'text-red-400 hover:bg-red-500/10'
                    )}
                  >
                    {user.isActive ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{user.isActive ? 'Aktywny' : 'Nieaktywny'}</span>
                  </button>
                  {!isCurrentUser && (
                    <button
                      onClick={() => setDeleteUser(user)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Usuń</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

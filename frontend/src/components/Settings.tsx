import { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, IconButton, Fade, 
  TextField, Button 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import LogoutIcon from '@mui/icons-material/Logout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUser, fetchFriends, appContext, apiClient } from '../lib/api';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function Settings({ open, onClose, onLogout }: SettingsProps) {
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['user'], queryFn: fetchUser, enabled: open });
  const { data: friends } = useQuery({ queryKey: ['friends'], queryFn: fetchFriends, enabled: open });

  const [name, setName] = useState("");

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await apiClient.put(`/users/${appContext.userId}`, { name: newName });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      alert("名前を更新しました");
    }
  });

  const blockFriendMutation = useMutation({
    mutationFn: async (friendId: number) => {
      await apiClient.post('/friendships/block', { target_user_id: friendId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['ranking'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
    }
  });

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      TransitionComponent={Fade}
      transitionDuration={{ enter: 400, exit: 300 }}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: '24px', border: '1px solid #e8ede8', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' } }}
    >
      <div className="flex justify-between items-center px-6 pt-6 pb-2">
        <h3 className="text-xl font-extrabold m-0 text-[#0f1f10]">Settings</h3>
        <IconButton onClick={onClose} className="transition-transform duration-300 hover:rotate-90">
          <CloseIcon />
        </IconButton>
      </div>
      
      <DialogContent sx={{ px: 3, pb: 4 }}>
        <div className="flex flex-col gap-6">
          
          <div className="flex flex-col gap-2">
            <h4 className="text-[13px] font-bold text-[#64748b] m-0 uppercase tracking-wider">Profile</h4>
            <div className="flex gap-2">
              <TextField 
                size="small"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ユーザー名"
                variant="outlined"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <Button 
                variant="contained" 
                onClick={() => updateNameMutation.mutate(name)}
                disabled={!name || name === user?.name || updateNameMutation.isPending}
                sx={{ 
                  borderRadius: '12px', 
                  bgcolor: '#13ec37', 
                  color: '#0f1f10', 
                  fontWeight: 'bold',
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: '#0fbf2c', boxShadow: 'none' },
                  '&.Mui-disabled': { bgcolor: '#e8ede8', color: '#94a3b8' }
                }}
              >
                保存
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="text-[13px] font-bold text-[#64748b] m-0 uppercase tracking-wider">Friends</h4>
            <div className="bg-[#f8faf8] border border-[#e8ede8] rounded-xl max-h-48 overflow-y-auto p-1.5 shadow-inner">
              {friends?.length ? (
                friends.map((friend: any) => (
                  <div key={friend.id || friend.friend_id} className="flex justify-between items-center p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-[#e8ede8] hover:shadow-sm">
                    <span className="text-[14px] font-bold text-[#0f1f10]">{friend.name || `User ${friend.friend_id}`}</span>
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        if(window.confirm('このフレンドをブロックしますか？\n相手のフィードにお互いの投稿が表示されなくなります。')) {
                          blockFriendMutation.mutate(friend.friend_id || friend.id);
                        }
                      }}
                      sx={{ 
                        color: '#94a3b8', 
                        bgcolor: 'white',
                        border: '1px solid #e8ede8',
                        '&:hover': { color: '#ef4444', bgcolor: '#fef2f2', borderColor: '#fca5a5' } 
                      }}
                    >
                      <BlockIcon fontSize="small" />
                    </IconButton>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[#64748b] text-center my-4 font-bold">フレンドがいません</p>
              )}
            </div>
          </div>
          
          <div className="pt-4 border-t border-[#e8ede8]">
            <Button 
              fullWidth 
              color="error" 
              variant="text" 
              startIcon={<LogoutIcon />}
              onClick={onLogout}
              sx={{ 
                fontWeight: 'bold', 
                borderRadius: '12px', 
                py: 1.5,
                bgcolor: '#fef2f2',
                '&:hover': { bgcolor: '#fee2e2' }
              }}
            >
              ログアウト
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
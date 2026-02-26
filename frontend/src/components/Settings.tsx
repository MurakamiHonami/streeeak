import { useState, useEffect, useRef } from 'react';
import { 
  Dialog, DialogContent, IconButton, Fade, 
  Button 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import LogoutIcon from '@mui/icons-material/Logout';
import DiamondIcon from '@mui/icons-material/Diamond';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUser, fetchFriends, appContext, apiClient, resolveApiAssetUrl, uploadUserAvatar } from '../lib/api';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

const stripePromise = loadStripe("pk_live_51T4d6fHu8x2kEWKOkL0KdL07M9woIYFgNDMLajHjhCCjLegmX0IpxHym0XE4nFskQxXXpm63Nm1qRMpijKlpUmIC00AxYOXrNt");

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarAdjusting, setIsAvatarAdjusting] = useState(false);
  const [hasPendingAvatarChange, setHasPendingAvatarChange] = useState(false);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const [isAvatarDragging, setIsAvatarDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [avatarSaveMessage, setAvatarSaveMessage] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const greenOutlinedButtonSx = {
    borderRadius: '10px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    fontSize: '12px',
    color: '#0f1f10',
    borderColor: '#bbf2c4',
    bgcolor: '#eafbe9',
    '&:hover': {
      borderColor: '#13ec37',
      bgcolor: '#d1f5d8',
    },
    '&.Mui-disabled': {
      borderColor: '#d8e4d8',
      bgcolor: '#f8faf8',
      color: '#94a3b8',
    },
  };

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  useEffect(() => {
    if (!open) {
      setIsProfileEditOpen(false);
      setAvatarFile(null);
      setIsAvatarAdjusting(false);
      setHasPendingAvatarChange(false);
      setAvatarZoom(1);
      setAvatarOffset({ x: 0, y: 0 });
      setAvatarSaveMessage("");
    }
  }, [open]);

  useEffect(() => {
    if (!avatarSaveMessage || avatarSaveMessage === "保存中...") {
      return;
    }
    const timer = window.setTimeout(() => {
      setAvatarSaveMessage("");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [avatarSaveMessage]);

  const effectiveAvatarSrc = avatarPreview ?? resolveApiAssetUrl(user?.avatar_url) ?? null;

  const ensureEditableAvatarFile = async (): Promise<File | null> => {
    if (avatarFile) {
      return avatarFile;
    }
    if (!effectiveAvatarSrc) {
      return null;
    }
    const response = await fetch(effectiveAvatarSrc);
    if (!response.ok) {
      throw new Error("avatar fetch failed");
    }
    const blob = await response.blob();
    const file = new File([blob], "avatar-source.png", { type: blob.type || "image/png" });
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(blob));
    return file;
  };

  const buildAvatarUploadFile = async (sourceFile: File): Promise<File | null> => {
    const img = new Image();
    const sourceUrl = URL.createObjectURL(sourceFile);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      img.src = sourceUrl;
    });

    const canvasSize = 512;
    const previewSize = 112;
    const factor = canvasSize / previewSize;
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const baseScale = Math.max(canvasSize / img.width, canvasSize / img.height);
    const drawScale = baseScale * avatarZoom;
    const drawWidth = img.width * drawScale;
    const drawHeight = img.height * drawScale;
    const dx = (canvasSize - drawWidth) / 2 + avatarOffset.x * factor;
    const dy = (canvasSize - drawHeight) / 2 + avatarOffset.y * factor;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
    URL.revokeObjectURL(sourceUrl);
    if (!blob) return null;
    return new File([blob], "avatar.png", { type: "image/png" });
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const res = await apiClient.put(`/users/${appContext.userId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      alert("プロフィールを更新しました");
    }
  });

  const handleAvatarSave = async () => {
    setAvatarSaveMessage("保存中...");
    setIsAvatarSaving(true);
    try {
      const sourceFile = await ensureEditableAvatarFile().catch(() => null);
      if (!sourceFile) {
        setAvatarSaveMessage("画像が選択されていません");
        return;
      }

      let uploadFile = sourceFile;
      try {
        const transformedFile = await buildAvatarUploadFile(sourceFile);
        if (transformedFile) {
          uploadFile = transformedFile;
        }
      } catch {
        // Fallback: use source file when transform fails.
      }

      const updatedUser = await uploadUserAvatar(uploadFile);
      queryClient.setQueryData(['user'], updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user'] });

      setAvatarFile(null);
      setAvatarPreview(null);
      setIsAvatarDragging(false);
      setIsAvatarAdjusting(false);
      setHasPendingAvatarChange(false);
      setAvatarZoom(1);
      setAvatarOffset({ x: 0, y: 0 });
      setAvatarSaveMessage("保存しました");
    } catch {
      setAvatarSaveMessage("保存に失敗しました");
    } finally {
      setIsAvatarSaving(false);
    }
  };

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

  const handleUpgradeClick = async () => {
    try {
      const res = await apiClient.post('/stripe/create-checkout-session');
      setClientSecret(res.data.clientSecret);
      setIsCheckoutOpen(true);
    } catch (error: any) {
      console.error("Stripe Error:", error.response?.data || error.message);
      alert("決済セッションの作成に失敗しました。ログイン状態を確認してください。");
    }
  };

  const handleRenameClick = () => {
    const currentName = user?.name ?? "";
    const nextName = window.prompt("新しい表示名を入力してください", currentName)?.trim();
    if (!nextName || nextName === currentName) {
      return;
    }
    updateProfileMutation.mutate({ name: nextName });
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => {
        setIsCheckoutOpen(false);
        setIsProfileEditOpen(false);
        setAvatarFile(null);
        setIsAvatarAdjusting(false);
        setHasPendingAvatarChange(false);
        setAvatarZoom(1);
        setAvatarOffset({ x: 0, y: 0 });
        onClose();
      }}
      TransitionComponent={Fade}
      transitionDuration={{ enter: 400, exit: 300 }}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: '24px', border: '1px solid #e8ede8', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' } }}
    >
      <div className="flex justify-between items-center px-6 pt-6 pb-2">
        <h3 className="text-xl font-extrabold m-0 text-[#0f1f10]">
          {isCheckoutOpen ? "Upgrade Plan" : "Settings"}
        </h3>
        <IconButton onClick={onClose} className="transition-transform duration-300 hover:rotate-90">
          <CloseIcon />
        </IconButton>
      </div>
      
      <DialogContent sx={{ px: 3, pb: 4 }}>
        {isCheckoutOpen && clientSecret ? (
          <div className="fade-in">
             <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
               <EmbeddedCheckout />
             </EmbeddedCheckoutProvider>
             <Button 
               fullWidth variant="text" sx={{ mt: 2, color: '#64748b', fontWeight: 'bold' }}
               onClick={() => setIsCheckoutOpen(false)}
             >
               キャンセルして戻る
             </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 fade-in">
            
            <div className="flex flex-col gap-2 p-4 bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] border border-[#bbf2c4] rounded-xl shadow-sm">
              <div className="flex items-center gap-2">
                <DiamondIcon sx={{ color: '#10b981' }} fontSize="small" />
                <h4 className="text-[14px] font-bold text-[#065f46] m-0">Premium Plan</h4>
              </div>
              <p className="text-[12px] text-[#047857] m-0 leading-relaxed font-bold">
                月額300円でAIブレイクダウンを無制限に利用可能になります！
              </p>
              <Button 
                variant="contained" 
                onClick={handleUpgradeClick}
                sx={{ 
                  mt: 1, borderRadius: '10px', bgcolor: '#10b981', color: '#fff', fontWeight: 'bold', boxShadow: 'none',
                  '&:hover': { bgcolor: '#059669', boxShadow: 'none' }
                }}
              >
                300円 / 月 でアップグレード
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-[13px] font-bold text-[#64748b] m-0 uppercase tracking-wider">Profile</h4>
              <div className="relative">
                <div className="flex items-center justify-between p-3 rounded-2xl border border-[#e8ede8] bg-[#f8faf8]">
                  <div className="flex items-center gap-3 min-w-0">
                    {user?.avatar_url ? (
                      <img
                        src={resolveApiAssetUrl(user.avatar_url) ?? ""}
                        alt="profile avatar"
                        className="w-12 h-12 rounded-full object-cover border border-[#d8e4d8] shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-[#d8e4d8] bg-white text-[#64748b] font-extrabold flex items-center justify-center shadow-sm">
                        {(user?.name?.trim()?.[0] ?? "U").toUpperCase()}
                      </div>
                    )}
                    <p className="m-0 text-[16px] font-extrabold text-[#0f1f10] truncate">
                      {user?.name || "User"}
                    </p>
                  </div>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={() => setIsProfileEditOpen(true)}
                    sx={{
                      minWidth: 'auto',
                      px: 1.2,
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#334155',
                      borderColor: '#d8e4d8',
                      bgcolor: 'white',
                      '&:hover': { borderColor: '#13ec37', bgcolor: '#f0fdf4' }
                    }}
                  >
                    編集
                  </Button>
                </div>
                <>
                  <div
                    className={`absolute inset-0 z-10 rounded-2xl bg-black/5 transition-opacity duration-200 ${
                      isProfileEditOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                    onClick={() => setIsProfileEditOpen(false)}
                  />
                  <div
                    className={`absolute left-0 right-0 top-0 z-20 rounded-2xl border border-[#e8ede8] bg-[#f8faf8] p-3 shadow-2xl transition-all duration-250 ease-out ${
                      isProfileEditOpen
                        ? "opacity-100 -translate-y-2"
                        : "opacity-0 translate-y-2 pointer-events-none"
                    }`}
                  >
                  <div className="flex items-center justify-between">
                    <p className="m-0 text-[12px] text-[#64748b] font-bold">プロフィール設定</p>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 14 }} />}
                      onClick={() => {
                        setIsProfileEditOpen(false);
                        setAvatarFile(null);
                        setIsAvatarAdjusting(false);
                        setHasPendingAvatarChange(false);
                        setAvatarZoom(1);
                        setAvatarOffset({ x: 0, y: 0 });
                        setName(user?.name ?? "");
                      }}
                      sx={{ minWidth: 'auto', px: 1, fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}
                    >
                      戻る
                    </Button>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-28 shrink-0 flex flex-col items-center gap-2">
                      {effectiveAvatarSrc ? (
                        <div
                          className={`w-28 h-28 rounded-full border border-[#d8e4d8] shadow-sm overflow-hidden bg-white ${
                            isAvatarAdjusting ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                          }`}
                          onClick={async () => {
                            if (!isAvatarAdjusting) {
                              try {
                                await ensureEditableAvatarFile();
                              } catch {
                                // keep current source if prefetch fails
                              }
                              setIsAvatarAdjusting(true);
                              setHasPendingAvatarChange(true);
                              setAvatarZoom(1);
                              setAvatarOffset({ x: 0, y: 0 });
                            }
                          }}
                          onPointerDown={(e) => {
                            if (!isAvatarAdjusting) return;
                            setIsAvatarDragging(true);
                            setDragStart({ x: e.clientX - avatarOffset.x, y: e.clientY - avatarOffset.y });
                            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                          }}
                          onPointerMove={(e) => {
                            if (!isAvatarAdjusting || !isAvatarDragging) return;
                            setAvatarOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                          }}
                          onPointerUp={() => setIsAvatarDragging(false)}
                          onPointerCancel={() => setIsAvatarDragging(false)}
                          onWheel={(e) => {
                            if (!isAvatarAdjusting) return;
                            e.preventDefault();
                            setAvatarZoom((prev) => Math.min(3, Math.max(1, prev - e.deltaY * 0.0015)));
                            setHasPendingAvatarChange(true);
                          }}
                        >
                          <img
                            src={effectiveAvatarSrc}
                            alt="avatar preview"
                            draggable={false}
                            className="w-full h-full object-cover select-none"
                            style={{
                              transform: `translate(${avatarOffset.x}px, ${avatarOffset.y}px) scale(${avatarZoom})`,
                              transformOrigin: "center",
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-28 h-28 rounded-full border border-[#d8e4d8] bg-white text-[#64748b] font-extrabold text-4xl flex items-center justify-center shadow-sm">
                          {(user?.name?.trim()?.[0] ?? "U").toUpperCase()}
                        </div>
                      )}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setAvatarFile(file);
                          if (file) {
                            setIsAvatarAdjusting(true);
                            setHasPendingAvatarChange(true);
                            setAvatarZoom(1);
                            setAvatarOffset({ x: 0, y: 0 });
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <Button
                        variant="outlined"
                        disabled={isAvatarSaving}
                        onClick={async () => {
                          if (hasPendingAvatarChange) {
                            await handleAvatarSave();
                            return;
                          }
                          avatarInputRef.current?.click();
                        }}
                        sx={greenOutlinedButtonSx}
                      >
                        {isAvatarSaving ? "保存中..." : hasPendingAvatarChange ? "保存" : "変更"}
                      </Button>
                      {avatarSaveMessage ? (
                        <p className="m-0 text-[11px] text-[#64748b] text-center w-full transition-opacity duration-300 opacity-100">
                          {avatarSaveMessage}
                        </p>
                      ) : null}
                      {isAvatarAdjusting && effectiveAvatarSrc ? (
                        <input
                          type="range"
                          min={0.5}
                          max={3}
                          step={0.01}
                          value={avatarZoom}
                          onChange={(e) => {
                            setAvatarZoom(Number(e.target.value));
                            setHasPendingAvatarChange(true);
                          }}
                          className="w-full"
                        />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 mt-8">
                        <p className="m-0 text-[20px] font-extrabold text-[#0f1f10] break-words">
                          {user?.name || "User"}
                        </p>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleRenameClick}
                          disabled={updateProfileMutation.isPending}
                          sx={greenOutlinedButtonSx}
                        >
                          名前変更
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                </>
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
                        sx={{ color: '#94a3b8', bgcolor: 'white', border: '1px solid #e8ede8', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2', borderColor: '#fca5a5' } }}
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
                fullWidth color="error" variant="text" startIcon={<LogoutIcon />} onClick={onLogout}
                sx={{ fontWeight: 'bold', borderRadius: '12px', py: 1.5, bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}
              >
                ログアウト
              </Button>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
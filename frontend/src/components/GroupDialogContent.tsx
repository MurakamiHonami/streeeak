import { useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import type { Task } from "../types";
import { CircularProgress, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import Diversity3Icon from '@mui/icons-material/Diversity3';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { 
  appContext, 
  apiClient,
  fetchGroups, 
  createGroup, 
  fetchGroupMembers, 
  addGroupMember, 
  removeGroupMember,
  fetchFriends,
  fetchUser,
  resolveApiAssetUrl
} from "../lib/api";

type ViewState = "list" | "create" | "detail";

type MemberTaskData = {
  userId: number;
  tasks: Task[];
};

const fetchMemberTasks = async (userId: number): Promise<MemberTaskData> => {
  const res = await apiClient.get<Task[]>(`/tasks`, { 
    params: { user_id: userId, type: "daily", date: appContext.today } 
  });
  return { userId, tasks: res.data || [] };
};

const getFriendInfo = (f: any) => f.friend || f;

function MemberTaskAccordion({ userId, name, avatarUrl, isYou, tasks }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const doneCount = tasks.filter((t: any) => t.is_done).length;

  return (
    <div className="flex flex-col">
      <div 
        className="flex items-center justify-between cursor-pointer p-1 -mx-1 rounded-lg hover:bg-[#f1f5f9] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img src={resolveApiAssetUrl(avatarUrl)!} alt={name} className="w-5 h-5 rounded-full object-cover border border-[#e8ede8]" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#f1f5f9] border border-[#e8ede8] flex items-center justify-center text-[10px] font-bold text-[#64748b]">
              {name[0]}
            </div>
          )}
          <span className={`text-[12px] font-bold ${isYou ? 'text-[#0fbf2c]' : 'text-[#64748b]'}`}>{name}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-[#64748b]">{doneCount}/{tasks.length}</span>
          <ExpandMoreIcon 
            sx={{ 
              fontSize: 18, 
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }} 
          />
        </div>
      </div>
      
      <div 
        className={`grid transition-[grid-template-rows,opacity,margin] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-[#f8faf8] rounded-xl border border-[#e8ede8] p-3 flex flex-col gap-2">
            {tasks.map((t: any) => (
              <div key={t.id} className="flex items-start gap-2">
                <div className="mt-[2px] shrink-0">
                  {t.is_done ? (
                    <TaskAltIcon sx={{ color: "#13ec37", fontSize: 16 }} />
                  ) : (
                    <div className="w-[14px] h-[14px] rounded-full border-2 border-[#cbd5e1] ml-[1px]" />
                  )}
                </div>
                <span className={`text-[13px] font-bold leading-tight ${t.is_done ? 'text-[#94a3b8] line-through' : 'text-[#0f1f10]'}`}>
                  {t.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GroupDialogContent() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewState>("list");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { data: userProfile } = useQuery({ queryKey: ["user"], queryFn: fetchUser });
  const { data: friends } = useQuery({ queryKey: ["friends"], queryFn: fetchFriends });

  const { data: groups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["groups", appContext.userId],
    queryFn: () => fetchGroups(appContext.userId),
  });

  const { data: members, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["groupMembers", selectedGroupId],
    queryFn: () => fetchGroupMembers(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const memberTaskQueries = useQueries({
    queries: (members || []).map((m: any) => ({
      queryKey: ["tasks", "daily", m.user_id, appContext.today],
      queryFn: () => fetchMemberTasks(m.user_id),
      enabled: !!members,
    }))
  }) as UseQueryResult<MemberTaskData, Error>[];

  const handleViewChange = (newView: ViewState, groupId?: number | null) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setView(newView);
      if (groupId !== undefined) {
        setSelectedGroupId(groupId);
      }
      setIsTransitioning(false);
    }, 400);
  };

  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setGroupName("");
      handleViewChange("list", null);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: addGroupMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupMembers", selectedGroupId] });
      setNewMemberId("");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeGroupMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupMembers", selectedGroupId] });
    },
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    createGroupMutation.mutate({ name: groupName, owner_id: appContext.userId });
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberId || !selectedGroupId) return;
    addMemberMutation.mutate({ groupId: selectedGroupId, userId: Number(newMemberId) });
  };

  let content = null;

  if (view === "create") {
    content = (
      <div className="flex flex-col gap-4 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="flex items-center gap-2 mb-2">
          <IconButton onClick={() => handleViewChange("list", null)} size="small" disabled={isTransitioning} className="transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-gray-100 active:scale-95"><ArrowBackIcon /></IconButton>
          <h4 className="m-0 font-extrabold text-[#0f1f10] text-[16px]">新規グループ作成</h4>
        </div>
        <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="グループ名を入力"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full border border-[#e8ede8] rounded-xl p-3 text-[14px] outline-none text-[#0f1f10] bg-[#f8faf8] font-bold focus:border-[#13ec37] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            autoFocus
          />
          <button
            type="submit"
            disabled={!groupName.trim() || createGroupMutation.isPending || isTransitioning}
            className="bg-[#13ec37] text-[#0f1f10] font-bold py-3 rounded-xl shadow-[0_4px_16px_rgba(19,236,55,0.25)] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {createGroupMutation.isPending ? "作成中..." : "作成する"}
          </button>
        </form>
      </div>
    );
  } else if (view === "detail" && selectedGroupId) {
    const group = groups?.find((g: any) => g.id === selectedGroupId);
    
    const allMemberTasks = memberTaskQueries.map(q => q.data?.tasks || []).flat();
    const totalTeamTasks = allMemberTasks.length;
    const doneTeamTasks = allMemberTasks.filter(t => t.is_done).length;
    const teamProgress = totalTeamTasks > 0 ? Math.round((doneTeamTasks / totalTeamTasks) * 100) : 0;
    const isTasksLoading = memberTaskQueries.some(q => q.isLoading);

    const availableFriends = friends?.filter((f: any) => {
      const info = getFriendInfo(f);
      return !members?.some((m: any) => m.user_id === info.id);
    }) || [];

    content = (
      <div className="flex flex-col gap-4 font-['Plus_Jakarta_Sans',sans-serif] max-h-[70vh] overflow-y-auto pr-2 pb-2 duration-700">
        <div className="flex items-center gap-2 mb-1 sticky top-0 bg-white z-10 py-2">
          <IconButton onClick={() => handleViewChange("list", null)} size="small" disabled={isTransitioning} className="transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-gray-100 active:scale-95"><ArrowBackIcon /></IconButton>
          <h4 className="m-0 font-extrabold text-[#0f1f10] text-[18px] truncate">{group?.name}</h4>
        </div>

        <div className="bg-[#13ec37]/10 rounded-xl p-4 border border-[#13ec37]/30 shrink-0">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[12px] font-bold text-[#0fbf2c] uppercase tracking-wider">Team Progress</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-extrabold text-[#0fbf2c]">{teamProgress}%</span>
              <span className="text-[11px] font-bold text-[#0fbf2c]/70">({doneTeamTasks}/{totalTeamTasks})</span>
            </div>
          </div>
          <div className="h-[8px] bg-white/50 rounded-full overflow-hidden">
            <div className="h-full bg-[#13ec37] rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${teamProgress}%` }} />
          </div>
        </div>
        
        <div>
          <h5 className="text-[13px] font-bold text-[#64748b] mb-3">メンバーの今日の達成状況</h5>
          {isTasksLoading ? (
            <div className="flex justify-center p-4"><CircularProgress size={20} sx={{ color: '#13ec37' }} /></div>
          ) : memberTaskQueries.length === 0 ? (
            <p className="text-[12px] text-[#64748b] font-bold">メンバーがいません</p>
          ) : (
            <div className="flex flex-col gap-3">
              {memberTaskQueries.map(mq => {
                if (!mq.data) return null;
                const { userId, tasks } = mq.data;
                const isYou = userId === appContext.userId;
                const friendInfo = friends?.map(getFriendInfo).find((f: any) => f.id === userId);
                const name = isYou ? "あなた" : (friendInfo?.name || `User ${userId}`);
                const avatarUrl = isYou ? userProfile?.avatar_url : friendInfo?.avatar_url;
                
                const mTotal = tasks.length;
                const mDone = tasks.filter(t => t.is_done).length;
                const mPct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0;

                return (
                  <div key={userId} className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img src={resolveApiAssetUrl(avatarUrl)!} alt={name} className="w-8 h-8 rounded-full object-cover border border-[#e8ede8] shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#f1f5f9] border border-[#e8ede8] flex items-center justify-center text-[12px] font-bold text-[#64748b] shrink-0">
                        {name[0]}
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-end mb-1">
                        <span className={`text-[12px] font-bold ${isYou ? 'text-[#0fbf2c]' : 'text-[#0f1f10]'}`}>{name}</span>
                        <span className="text-[11px] font-extrabold text-[#64748b]">{mPct}% <span className="text-[10px] font-normal opacity-70">({mDone}/{mTotal})</span></span>
                      </div>
                      <div className="h-[6px] bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${mPct === 100 ? 'bg-[#13ec37]' : isYou ? 'bg-[#0fbf2c]' : 'bg-[#94a3b8]'}`} 
                          style={{ width: `${mPct}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h5 className="text-[13px] font-bold text-[#64748b] mb-3 mt-2">各メンバーのタスク</h5>
          {isTasksLoading ? (
            <div className="flex justify-center p-4"><CircularProgress size={24} sx={{ color: '#13ec37' }} /></div>
          ) : allMemberTasks.length === 0 ? (
            <div className="text-center py-6 bg-[#f8faf8] rounded-xl border border-[#e8ede8]">
              <p className="text-[12px] text-[#64748b] font-bold m-0">今日のタスクを持っているメンバーはいません</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {memberTaskQueries.map((mq) => {
                if (!mq.data || mq.data.tasks.length === 0) return null;
                const { userId, tasks } = mq.data;
                const isYou = userId === appContext.userId;
                const friendInfo = friends?.map(getFriendInfo).find((f: any) => f.id === userId);
                const name = isYou ? "あなた" : (friendInfo?.name || `ユーザー ${userId}`);
                const avatarUrl = isYou ? userProfile?.avatar_url : friendInfo?.avatar_url;

                return (
                  <MemberTaskAccordion
                    key={userId}
                    userId={userId}
                    name={name}
                    avatarUrl={avatarUrl}
                    isYou={isYou}
                    tasks={tasks}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[#e8ede8] my-2" />

        <div>
          <h5 className="text-[13px] font-bold text-[#64748b] mb-2">メンバー管理</h5>
          <form onSubmit={handleAddMember} className="flex gap-2 mb-3">
            <select
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
              className="flex-1 border border-[#e8ede8] rounded-lg p-2 text-[13px] outline-none bg-[#f8faf8] font-bold text-[#0f1f10] focus:border-[#13ec37] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            >
              <option value="">フレンドから選択して追加</option>
              {availableFriends.map((f: any) => {
                const info = getFriendInfo(f);
                return <option key={info.id} value={info.id}>{info.name}</option>;
              })}
            </select>
            <button 
              type="submit" 
              disabled={!newMemberId || addMemberMutation.isPending || isTransitioning} 
              className="bg-[#0f1f10] text-white px-4 rounded-lg text-[12px] font-bold transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black active:scale-[0.96] disabled:opacity-50"
            >
              追加
            </button>
          </form>

          {isLoadingMembers ? (
            <div className="flex justify-center p-4"><CircularProgress size={24} sx={{ color: '#13ec37' }} /></div>
          ) : (
            <div className="flex flex-col gap-2">
              {members?.map((member: any) => {
                const isYou = member.user_id === appContext.userId;
                const friendInfo = friends?.map(getFriendInfo).find((f: any) => f.id === member.user_id);
                const name = isYou ? "あなた" : (friendInfo?.name || `ユーザー ${member.user_id}`);
                const avatarUrl = isYou ? userProfile?.avatar_url : friendInfo?.avatar_url;

                return (
                  <div key={member.id} className="flex justify-between items-center p-2 rounded-lg bg-white border border-[#e8ede8] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[#cbd5e1]">
                    <div className="flex items-center gap-2">
                      {avatarUrl ? (
                        <img src={resolveApiAssetUrl(avatarUrl)!} alt={name} className="w-8 h-8 rounded-full object-cover border border-[#e8ede8]" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#f1f5f9] border border-[#e8ede8] flex items-center justify-center text-[12px] font-bold text-[#64748b]">
                          {name[0]}
                        </div>
                      )}
                      <span className={`text-[13px] font-bold ${isYou ? 'text-[#0fbf2c]' : 'text-[#0f1f10]'}`}>{name}</span>
                    </div>
                    {!isYou && (
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => {
                          if (window.confirm(`${name}をグループから外しますか？`)) {
                            removeMemberMutation.mutate({ groupId: selectedGroupId, userId: member.user_id });
                          }
                        }}
                        disabled={removeMemberMutation.isPending || isTransitioning}
                        className="transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-red-50 active:scale-95"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </div>
                );
              })}
              {members?.length === 0 && <p className="text-[12px] text-[#64748b] font-bold">メンバーがいません</p>}
            </div>
          )}
        </div>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-4 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="flex justify-between items-center mb-2">
          <h4 className="m-0 font-extrabold text-[#64748b] text-[13px] uppercase tracking-wider">Your Groups</h4>
          <button
            onClick={() => handleViewChange("create")}
            disabled={isTransitioning}
            className="flex items-center gap-1 text-[#0fbf2c] font-bold text-[13px] bg-[#13ec37]/10 px-3 py-1.5 rounded-full transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#13ec37]/20 hover:scale-[1.02] border-none cursor-pointer active:scale-[0.96] hover:shadow-sm disabled:opacity-50 disabled:hover:scale-100"
          >
            <AddIcon fontSize="small" /> 作成
          </button>
        </div>

        {isLoadingGroups ? (
          <div className="flex justify-center p-4"><CircularProgress size={24} sx={{ color: '#13ec37' }} /></div>
        ) : groups && groups.length > 0 ? (
          <div className="flex flex-col gap-3">
            {groups.map((group: any) => (
              <div
                key={group.id}
                onClick={() => handleViewChange("detail", group.id)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#f8faf8] border border-[#e8ede8] cursor-pointer transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[#13ec37]/50 hover:bg-[#13ec37]/5 hover:scale-[1.02] hover:shadow-sm active:scale-[0.96]"
              >
                <div className="w-10 h-10 rounded-full bg-[#13ec37]/10 text-[#0fbf2c] flex items-center justify-center border border-[#13ec37]/20">
                  <Diversity3Icon fontSize="small" />
                </div>
                <div className="flex-1">
                  <h5 className="m-0 text-[14px] font-bold text-[#0f1f10]">{group.name}</h5>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-[13px] font-bold text-[#64748b] mb-3">まだグループがありません</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`transition-all duration-700 ${
        isTransitioning ? "opacity-0" : "opacity-100"
      }`}
    >
      {content}
    </div>
  );
}
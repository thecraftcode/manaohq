import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Language } from '@/lib/i18n';

// ── Supabase columns (snake_case) ↔ App fields (camelCase) ──────────────────
// Only these 3 fields differ between Supabase and the app.
const fieldMap: Record<string, string> = {
  postDate: 'post_date',
  assetLink: 'asset_link',
  publishedLink: 'published_link',
  thumbnailUrl: 'thumbnail_url',
  referenceUrl: 'reference_url',
  completedAt: 'completed_at',
};

const reverseMap: Record<string, string> = Object.fromEntries(
  Object.entries(fieldMap).map(([k, v]) => [v, k])
);

/** Convert app camelCase → Supabase snake_case, and sanitize values for DB */
// Columns that are date-type in Supabase — empty strings must become null
const dateColumns = new Set(['deadline', 'post_date']);

function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const dbKey = fieldMap[k] ?? k;
    // PostgreSQL date columns reject empty strings — convert to null
    out[dbKey] = (v === '' && dateColumns.has(dbKey)) ? null : v;
  }
  return out;
}

/** Convert Supabase snake_case → app camelCase */
function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[reverseMap[k] ?? k] = v;
  }
  // Mutual fallback sync between assetLink and gdrive_link so neither is lost
  if (!out.assetLink && out.gdrive_link) {
    out.assetLink = out.gdrive_link;
  } else if (!out.gdrive_link && out.assetLink) {
    out.gdrive_link = out.assetLink;
  }
  return out;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ViewType = 'dashboard' | 'content' | 'analytics' | 'settings' | 'ideabank' | 'tags';
export type ContentViewType = 'table' | 'kanban' | 'calendar';
export type StatusType = string;
export type PresetRange = '7days' | '14days' | '30days' | 'custom' | 'all';
export interface DateRangeString { from?: string; to?: string; }

export interface TagDef {
  id: string;
  name: string;
  color: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at?: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at?: string;
}

export interface RawIdea {
  id: string;
  idea_text: string;
  reference_url: string | null;
  workspace_id?: string;
  created_at?: string;
}

// ── Post interface — matches Supabase 'posts' table exactly ──────────────────
// Supabase columns: id (uuid), created_at, idea, pillar, status, pic, deadline,
//   asset_link, funnel, type, post_date, published_link, script, hook, caption
export interface Post {
  id: string;             // UUID from Supabase
  idea: string;
  pillar: string;
  funnel: string;
  type: string;
  deadline: string;
  postDate: string;       // DB: post_date
  status: StatusType;
  assetLink: string;      // DB: asset_link
  publishedLink: string;  // DB: published_link
  script: string;
  brief?: string | null;
  pic?: string;
  hook?: string;
  caption?: string;
  ig_link?: string;
  gdrive_link?: string;
  thumbnailUrl?: string;  // DB: thumbnail_url
  referenceUrl?: string;  // DB: reference_url
  completedAt?: string | null; // DB: completed_at
  created_at?: string;
}

export interface Store {
  // Workspace
  activeWorkspaceId: string | null;
  activeRole: 'owner' | 'admin' | 'member' | null;
  workspaces: Workspace[];
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  showWorkspaceSettings: boolean;
  setShowWorkspaceSettings: (show: boolean) => void;

  // Navigation
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;

  // Content Hub
  contentView: ContentViewType;
  setContentView: (view: ContentViewType) => void;
  contentFilterYear: string;
  setContentFilterYear: (year: string) => void;
  contentFilterMonth: string;
  setContentFilterMonth: (month: string) => void;
  contentFilterWeek: string;
  setContentFilterWeek: (week: string) => void;
  contentAssignedToMe: boolean;
  setContentAssignedToMe: (assigned: boolean) => void;

  // Drawer
  drawerOpen: boolean;
  drawerPost: Post | null;
  drawerPrefill: { id: string; idea: string; assetLink: string } | null;
  openDrawer: (post?: Post | null, prefill?: { id: string; idea: string; assetLink: string } | null) => void;
  closeDrawer: () => void;

  // Focus Mode
  focusMode: boolean;
  toggleFocusMode: () => void;

  // Data
  rawIdeas: RawIdea[];
  fetchRawIdeas: () => Promise<void>;
  addRawIdea: (ideaText: string, referenceUrl?: string) => Promise<void>;
  deleteRawIdea: (id: string) => Promise<void>;

  posts: Post[];
  fetchPosts: () => Promise<void>;
  updatePost: (post: Post) => Promise<void>;
  updatePostFields: (id: string, updates: Partial<Post>) => Promise<void>;
  addPost: (post: Post) => Promise<void>;
  bulkAddPosts: (posts: Omit<Post, 'id'>[]) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  bulkDeletePosts: (ids: string[]) => Promise<void>;
  bulkUpdatePosts: (ids: string[], updates: Partial<Post>) => Promise<void>;
  updatePostStatus: (id: string, status: StatusType) => Promise<void>;

  // Manual sorting
  manualPostOrder: Record<string, string[]>; // workspace_id -> array of post ids
  setManualPostOrder: (workspaceId: string, order: string[]) => void;

  // Tags (workspace-specific, stored in Supabase)
  pillars: TagDef[];
  contentTypes: TagDef[];
  funnels: TagDef[];
  statuses: TagDef[];
  fetchTags: () => Promise<void>;
  addPillar: (name: string, color: string) => Promise<void>;
  deletePillar: (id: string) => Promise<void>;
  addContentType: (name: string, color: string) => Promise<void>;
  deleteContentType: (id: string) => Promise<void>;
  addFunnel: (name: string, color: string) => Promise<void>;
  deleteFunnel: (id: string) => Promise<void>;
  addStatus: (name: string, color: string) => Promise<void>;
  deleteStatus: (id: string) => Promise<void>;
  updateTag: (id: string, name: string, color: string, category: 'pillar' | 'funnel' | 'contentType' | 'status') => Promise<void>;
  reorderTags: (category: 'pillar' | 'funnel' | 'contentType' | 'status', reorderedItems: TagDef[]) => Promise<void>;

  // Team
  teamMembers: TeamMember[];
  currentUser: string;
  currentUserProfile: { name: string; email: string; role: string; avatar_url?: string } | null;
  fetchTeamMembers: () => Promise<void>;
  fetchCurrentUserProfile: () => Promise<void>;
  addTeamMember: (member: { name: string; email: string; role: string }) => Promise<void>;
  updateTeamMemberRole: (id: string, role: string) => Promise<void>;
  deleteTeamMember: (id: string) => Promise<void>;

  // Settings
  activeSettingsTab: 'profile' | 'team' | 'tags' | 'appearance' | 'notifications';
  setActiveSettingsTab: (tab: 'profile' | 'team' | 'tags' | 'appearance' | 'notifications') => void;

  // Notification Preferences
  notificationPrefs: {
    assignment: boolean;
    deadlineReminder: boolean;
    missedShare: boolean;
    ownerReport: boolean;
    postingReminder: boolean;
  };
  setNotificationPref: (key: 'assignment' | 'deadlineReminder' | 'missedShare' | 'ownerReport' | 'postingReminder', value: boolean) => void;
  fetchNotificationPrefs: () => Promise<void>;

  // Language
  language: Language;
  setLanguage: (lang: Language) => void;

  // Mobile
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;

  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Dashboard Preferences
  dashboardCards: DashboardCardConfig[];
  updateDashboardCard: (slotId: string, category: DashboardCardConfig['category'], value: string) => void;
  dashboardPresetRange: PresetRange;
  setDashboardPresetRange: (preset: PresetRange) => void;
  dashboardDateRange: DateRangeString | undefined;
  setDashboardDateRange: (range: DateRangeString | undefined) => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export type DashboardCardConfig = {
  slotId: string;
  category: 'status' | 'pillar' | 'funnel' | 'type' | 'pic' | 'special';
  value: string;
};

// ... Store Interface updates ...

const defaultPillars: TagDef[] = [
  { id: 'p1', name: 'Thought Leadership', color: '#6366f1' },
  { id: 'p2', name: 'Education', color: '#10b981' },
  { id: 'p3', name: 'Brand Story', color: '#f59e0b' },
  { id: 'p4', name: 'Social Proof', color: '#f43f5e' },
  { id: 'p5', name: 'Community', color: '#0ea5e9' },
];

const defaultFunnels: TagDef[] = [
  { id: 'f1', name: 'ToFu', color: '#3b82f6' },
  { id: 'f2', name: 'MoFu', color: '#8b5cf6' },
  { id: 'f3', name: 'BoFu', color: '#d946ef' },
];

const defaultContentTypes: TagDef[] = [
  { id: 't1', name: 'Long-form Article', color: '#0f766e' },
  { id: 't2', name: 'Video', color: '#b91c1c' },
  { id: 't3', name: 'Infographic', color: '#d97706' },
  { id: 't4', name: 'Social Post', color: '#4338ca' },
];

const defaultStatuses: TagDef[] = [
  { id: 's2', name: 'Draft', color: '#eab308' },
  { id: 's2_5', name: 'In Progress', color: '#06b6d4' },
  { id: 's3', name: 'Review', color: '#3b82f6' },
  { id: 's4', name: 'Approved', color: '#10b981' },
  { id: 's5', name: 'Scheduled', color: '#8b5cf6' },
  { id: 's6', name: 'Published', color: '#22c55e' },
  { id: 's7', name: 'Shared', color: '#f97316' },
];

// ── Store ────────────────────────────────────────────────────────────────────

// Safe localStorage adapter that catches QuotaExceededError and prevents crashes
const safeStorage = createJSONStorage(() => ({
  getItem: (key: string) => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('[Storage] QuotaExceededError caught safely:', e);
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  },
  removeItem: (key: string) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}
  },
}));

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // ── Workspace ─────────────────────────────────────────────────────
      activeWorkspaceId: null,
      activeRole: null,
      workspaces: [],
      
      // ── Dashboard Preferences ─────────────────────────────────────────
      dashboardCards: [
        { slotId: 'slot1', category: 'special', value: 'drafts' },
        { slotId: 'slot2', category: 'special', value: 'briefs' },
        { slotId: 'slot3', category: 'status', value: 'Review' },
        { slotId: 'slot4', category: 'status', value: 'Scheduled' },
        { slotId: 'slot5', category: 'status', value: 'Published' }
      ],
      updateDashboardCard: (slotId, category, value) => set((state) => ({
        dashboardCards: state.dashboardCards.map(c => 
          c.slotId === slotId ? { ...c, category, value } : c
        )
      })),
      dashboardPresetRange: 'all',
      setDashboardPresetRange: (preset) => set({ dashboardPresetRange: preset }),
      dashboardDateRange: undefined,
      setDashboardDateRange: (range) => set({ dashboardDateRange: range }),

      // ── Content Hub Filters ─────────────────────────────────────────
      contentFilterYear: new Date().getFullYear().toString(),
      setContentFilterYear: (year) => set({ contentFilterYear: year }),
      contentFilterMonth: String(new Date().getMonth() + 1).padStart(2, '0'),
      setContentFilterMonth: (month) => set({ contentFilterMonth: month }),
      contentFilterWeek: 'all',
      setContentFilterWeek: (week) => set({ contentFilterWeek: week }),
      contentAssignedToMe: false,
      setContentAssignedToMe: (assigned) => set({ contentAssignedToMe: assigned }),

      fetchWorkspaces: async () => {
        try {
          // Step 1: Get the current authenticated user
          const { data: { user }, error: authErr } = await supabase.auth.getUser();

          if (authErr || !user) {
            set({ workspaces: [] });
            return;
          }

          // Step 2: Get workspace IDs the user belongs to (using user_id)
          const { data: memberships, error: memErr } = await supabase
            .from('workspace_members')
            .select('workspace_id, role')
            .eq('user_id', user.id);

          if (memErr) throw memErr;
          if (!memberships || memberships.length === 0) {
            set({ workspaces: [], activeWorkspaceId: null, activeRole: null, posts: [], rawIdeas: [] });
            return;
          }

          const wsIds = memberships.map((m: any) => m.workspace_id);

          // Step 3: Fetch workspace details
          const { data: wsData, error: wsErr } = await supabase
            .from('workspaces')
            .select('id, name, created_at')
            .in('id', wsIds);

          if (wsErr) throw wsErr;
          if (wsData) {
            set({ workspaces: wsData as Workspace[] });

            // Auto-select first workspace if none is active
            let currentId = get().activeWorkspaceId;
            if ((!currentId || !wsData.find((w: any) => w.id === currentId)) && wsData.length > 0) {
              currentId = wsData[0].id;
              set({ activeWorkspaceId: currentId });
            }

            // Derivative: Set activeRole based on memberships
            if (currentId) {
              const myMembership = memberships.find((m: any) => m.workspace_id === currentId);
              set({ activeRole: myMembership?.role || 'member' });
            }
          } else {
            set({ workspaces: [], activeWorkspaceId: null, activeRole: null, posts: [], rawIdeas: [] });
          }
        } catch (error) {
          console.warn('Notice fetching workspaces:', error);
          set({ workspaces: [], activeWorkspaceId: null, activeRole: null, posts: [], rawIdeas: [] });
        }
      },

      createWorkspace: async (name: string) => {
        try {
          // 0. Get current user
          const { data: { user }, error: authErr } = await supabase.auth.getUser();
          if (authErr || !user) throw new Error('User not authenticated');

          // 1. Insert workspace
          const { data: ws, error: wsErr } = await supabase
            .from('workspaces')
            .insert([{ name }])
            .select('*')
            .single();
          if (wsErr) {
            console.error('Workspace Insert Error:', wsErr);
            throw new Error(wsErr.message || JSON.stringify(wsErr));
          }

          // 2. Add creator as owner in workspace_members
          const { error: memErr } = await supabase
            .from('workspace_members')
            .insert([{
              workspace_id: ws.id,
              user_id: user.id,
              user_name: user.email,
              role: 'owner',
            }]);
          if (memErr) {
            console.error('Workspace Member Insert Error:', memErr);
            throw new Error(memErr.message || JSON.stringify(memErr));
          }

          // 3. Add owner to team_members via server-side API (bypasses RLS)
          const profile = get().currentUserProfile;
          const creatorName = profile?.name || user.email?.split('@')[0] || 'Owner';
          try {
            const res = await fetch('/api/add-team-member', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: creatorName,
                email: user.email,
                role: 'Owner',
              }),
            });
            if (!res.ok) {
              const text = await res.text();
              try { console.warn('Team member API error:', JSON.parse(text).error); } catch { console.warn('Team member API error (non-JSON):', text.substring(0, 100)); }
            }
          } catch (apiErr) {
            console.warn('Team member API call failed:', apiErr);
          }

          // 3. Update local state & switch to new workspace
          const newWs: Workspace = { id: ws.id, name: ws.name, created_at: ws.created_at };
          set((s) => ({
            workspaces: [...s.workspaces, newWs],
            activeWorkspaceId: newWs.id,
            posts: [],
            rawIdeas: [],
          }));
          // Seed default tags for the new workspace
          const defaultSeeds = [
            ...defaultPillars.map(t => ({ workspace_id: ws.id, category: 'pillar', name: t.name, color: t.color })),
            ...defaultFunnels.map(t => ({ workspace_id: ws.id, category: 'funnel', name: t.name, color: t.color })),
            ...defaultContentTypes.map(t => ({ workspace_id: ws.id, category: 'contentType', name: t.name, color: t.color })),
            ...defaultStatuses.map(t => ({ workspace_id: ws.id, category: 'status', name: t.name, color: t.color })),
          ];
          await supabase.from('workspace_tags').insert(defaultSeeds);

          // Re-fetch data for the new (empty) workspace
          get().fetchPosts();
          get().fetchRawIdeas();
          get().fetchTeamMembers();
          get().fetchTags();

          // Auto-open settings modal for the newly created workspace
          get().setShowWorkspaceSettings(true);
        } catch (error: any) {
          console.error('Error creating workspace:', error?.message || error);
          throw error;
        }
      },

      setActiveWorkspace: (id: string) => {
        set({ activeWorkspaceId: id, posts: [], rawIdeas: [] });

        // Update activeRole immediately from existing workspaces logic if possible
        // or let fetchWorkspaces handle it. For now, we clear it so it re-syncs.
        set({ activeRole: null });
        get().fetchWorkspaces();

        // Re-fetch data for the new workspace
        get().fetchPosts();
        get().fetchRawIdeas();
        get().fetchTeamMembers();
        get().fetchTags();
      },

      showWorkspaceSettings: false,
      setShowWorkspaceSettings: (show) => set({ showWorkspaceSettings: show }),

      activeView: 'dashboard',
      setActiveView: (view) => set({ activeView: view }),

      contentView: 'table',
      setContentView: (view) => set({ contentView: view }),

      drawerOpen: false,
      drawerPost: null,
      drawerPrefill: null,
      openDrawer: (post, prefill) => set({ drawerOpen: true, drawerPost: post ?? null, drawerPrefill: prefill ?? null }),
      closeDrawer: () => set({ drawerOpen: false, drawerPost: null, drawerPrefill: null, focusMode: false }),

      focusMode: false,
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

      posts: [],

      rawIdeas: [],

      manualPostOrder: {},
      setManualPostOrder: (workspaceId, order) => set((s) => ({
        manualPostOrder: { ...s.manualPostOrder, [workspaceId]: order }
      })),

      // ── CRUD operations ──────────────────────────────────────────────────

      fetchRawIdeas: async () => {
        try {
          const wsId = get().activeWorkspaceId;
          if (!wsId) { set({ rawIdeas: [] }); return; }

          const { data, error } = await supabase
            .from('raw_ideas')
            .select('*')
            .eq('workspace_id', wsId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          if (data) set({ rawIdeas: data as RawIdea[] });
        } catch (error) {
          console.error('Error fetching raw ideas:', error);
        }
      },

      addRawIdea: async (ideaText, referenceUrl) => {
        try {
          const wsId = get().activeWorkspaceId;
          if (!wsId) throw new Error('No active workspace');

          const newIdea = { idea_text: ideaText, reference_url: referenceUrl || null, workspace_id: wsId };
          const { data, error } = await supabase
            .from('raw_ideas')
            .insert([newIdea])
            .select('*')
            .single();

          if (error) throw error;
          if (data) set((s) => ({ rawIdeas: [data as RawIdea, ...s.rawIdeas] }));
        } catch (error) {
          console.error('Error adding raw idea:', error);
          throw error;
        }
      },

      deleteRawIdea: async (id) => {
        try {
          const { error } = await supabase
            .from('raw_ideas')
            .delete()
            .eq('id', id);

          if (error) throw error;
          set((s) => ({ rawIdeas: s.rawIdeas.filter((i) => i.id !== id) }));
        } catch (error) {
          console.error('Error deleting raw idea:', error);
        }
      },

      fetchPosts: async () => {
        try {
          const wsId = get().activeWorkspaceId;
          if (!wsId) { set({ posts: [] }); return; }

          const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('workspace_id', wsId)
            .order('post_date', { ascending: true })
            .order('created_at', { ascending: true });

          if (error) throw error;
          if (data) set({ posts: data.map((row) => toCamel(row) as unknown as Post) });
        } catch (error) {
          console.warn('Notice fetching posts:', error);
        }
      },

      updatePost: async (post) => {
        try {
          // ── Refresh session to ensure valid JWT ─────────────────────
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Session telah kedaluwarsa. Silakan login kembali.');
          }

          // ── Auto-Status Workflow ────────────────────────────────────
          const hasLink = !!(post.publishedLink?.trim() || post.ig_link?.trim());
          const hasAsset = !!(post.assetLink?.trim() || post.gdrive_link?.trim());
          const hasBrief = !!(post.script?.trim() || post.brief?.trim());

          let autoStatus: string | undefined;
          const currentRole = get().activeRole;
          if (hasLink) autoStatus = 'Published';
          else if (hasAsset) autoStatus = currentRole === 'member' ? 'Review' : 'Approved';
          else if (hasBrief) autoStatus = 'Draft';

          if (autoStatus && post.status !== autoStatus) {
            post = { ...post, status: autoStatus as any };
            console.log(`⚡ [Auto-Status] "${post.idea}" → ${autoStatus}`);
          }
          
          // ── Auto-Timestamp Completed ────────────────────────────────
          const doneStatuses = ['Approved', 'Scheduled', 'Published', 'Shared'];
          if (doneStatuses.includes(post.status) && !post.completedAt) {
            post.completedAt = new Date().toISOString();
          }

          // ── Strip read-only fields ──────────────────────────────────
          const { id: _id, created_at: _ca, workspace_id: _wsId, ...cleanPost } = post as any;
          const snakeData = toSnake(cleanPost as Record<string, unknown>);

          // Keep asset_link and gdrive_link in sync for database compatibility
          if ('asset_link' in snakeData) {
            snakeData.gdrive_link = snakeData.asset_link;
          } else if ('gdrive_link' in snakeData) {
            snakeData.asset_link = snakeData.gdrive_link;
          }

          // Query strictly by primary key UUID
          let query = supabase
            .from('posts')
            .update(snakeData)
            .eq('id', post.id);

          const { data, error } = await query.select();

          if (error) {
            console.error('Supabase updatePost error:', error.message, {
              code: error.code, details: error.details, hint: error.hint,
            });
            throw error;
          }

          if (!data || data.length === 0) {
            throw new Error('Gagal memperbarui postingan: tidak ada baris yang tersimpan di database.');
          }

          const updatedRow = data[0] ? (toCamel(data[0]) as unknown as Post) : post;
          set((s) => ({ posts: s.posts.map((p) => (p.id === post.id ? { ...p, ...updatedRow } : p)) }));

          // ── Notification for assigned PIC ──────────────────────────────
          const picValue = (post.pic ?? '').trim();
          const ideaText = (post.idea ?? '').trim() || 'Tanpa Judul';
          if (picValue && picValue !== 'Unassigned' && get().notificationPrefs.assignment) {
            const team = get().teamMembers;
            const member = team.find(m => m.name === picValue);
            if (member) {
              fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  workspaceId: get().activeWorkspaceId,
                  picName: picValue,
                  picEmail: member.email,
                  title: 'Update Tugas 🔄',
                  message: `Konten "${ideaText}" telah di-update dan di-assign ke kamu.`,
                  type: 'assignment',
                  postId: post.id,
                }),
              }).catch(err => console.log('Send notification failed:', err));
            }
          }
        } catch (error: any) {
          console.error('Error updating post:', error?.message || JSON.stringify(error));
          throw error;
        }
      },

      updatePostFields: async (id, updates) => {
        // ── Refresh session to ensure valid JWT ─────────────────────
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Session telah kedaluwarsa. Silakan login kembali.');
        }

        // ── Auto-Status Workflow ────────────────────────────────────
        // When brief/asset/link fields change, auto-compute status
        const autoStatusFields = ['script', 'brief', 'assetLink', 'publishedLink', 'ig_link', 'gdrive_link'];
        const touchesAutoField = autoStatusFields.some(f => f in updates);

        const existingPost = get().posts.find(p => p.id === id);
        if (touchesAutoField && existingPost) {
          const merged = { ...existingPost, ...updates };
          const hasLink = !!(merged.publishedLink?.trim() || merged.ig_link?.trim());
          const hasAsset = !!(merged.assetLink?.trim() || merged.gdrive_link?.trim());
          const hasBrief = !!(merged.script?.trim() || merged.brief?.trim());

          let autoStatus: string | undefined;
          const currentRole = get().activeRole;
          if (hasLink) autoStatus = 'Published';
          else if (hasAsset) autoStatus = currentRole === 'member' ? 'Review' : 'Approved';
          else if (hasBrief) autoStatus = 'Draft';

          if (autoStatus && merged.status !== autoStatus) {
            (updates as any).status = autoStatus;
            console.log(`⚡ [Auto-Status] "${existingPost.idea}" → ${autoStatus}`);
          }
        }

        // ── Strip read-only / non-DB fields before sending ──────────
        const { id: _id, created_at: _ca, workspace_id: _wsId, ...cleanUpdates } = updates as any;
        const snakeUpdates = toSnake(cleanUpdates as Record<string, unknown>);

        // Keep asset_link and gdrive_link in sync
        if ('asset_link' in snakeUpdates) {
          snakeUpdates.gdrive_link = snakeUpdates.asset_link;
        } else if ('gdrive_link' in snakeUpdates) {
          snakeUpdates.asset_link = snakeUpdates.gdrive_link;
        }

        // Skip if there's nothing to update
        if (Object.keys(snakeUpdates).length === 0) return;

        // ── Optimistic UI Update ────────────────────────────────────
        const previousPosts = get().posts;
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));

        try {
          // Query strictly by primary key UUID (RLS already enforces workspace membership)
          let query = supabase
            .from('posts')
            .update(snakeUpdates)
            .eq('id', id);

          const { data, error } = await query.select();

          if (error) {
            set({ posts: previousPosts }); // Revert on failure
            console.error('Supabase updatePostFields error:', error.message, {
              code: error.code,
              details: error.details,
              hint: error.hint,
              updates: snakeUpdates,
              postId: id,
            });
            throw error;
          }

          if (!data || data.length === 0) {
            set({ posts: previousPosts }); // Revert on failure
            const noRowsErr = new Error('Gagal memperbarui data: 0 baris tersimpan di database.');
            console.error('Update affected 0 rows:', { id, updates: snakeUpdates });
            throw noRowsErr;
          }

          // Sync exact row returned from database back into state
          if (data[0]) {
            const returnedPost = toCamel(data[0]) as unknown as Post;
            set((s) => ({
              posts: s.posts.map((p) => (p.id === id ? { ...p, ...returnedPost } : p)),
            }));
          }

          // ── Notification when PIC is assigned via inline edit ───────────
          if ('pic' in updates) {
            const picValue = ((updates as any).pic ?? '').trim();
            const currentPost = (useStore.getState() as Store).posts.find(p => p.id === id);
            const ideaText = (currentPost?.idea ?? '').trim() || 'Tanpa Judul';
            if (picValue && picValue !== 'Unassigned' && get().notificationPrefs.assignment) {
              const team = (useStore.getState() as Store).teamMembers;
              const member = team.find(m => m.name === picValue);
              if (member) {
                fetch('/api/send-notification', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    workspaceId: get().activeWorkspaceId,
                    picName: picValue,
                    picEmail: member.email,
                    title: 'Tugas Di-update! 📝',
                    message: `Kamu di-assign untuk konten: "${ideaText}"`,
                    type: 'assignment',
                    postId: id,
                  }),
                }).catch(err => console.log('Send notification failed:', err));
              }
            }
          }
        } catch (error: any) {
          set({ posts: previousPosts }); // Revert on failure
          console.error('Error updating post fields:', error?.message || JSON.stringify(error));
          throw error;
        }
      },

      addPost: async (post) => {
        try {
          const wsId = get().activeWorkspaceId;
          if (!wsId) throw new Error('No active workspace');

          // Exclude client-side `id` — Supabase auto-generates UUID
          const { id, created_at, ...rest } = post;
          const snakeData = { ...toSnake(rest as unknown as Record<string, unknown>), workspace_id: wsId };

          const { data, error } = await supabase
            .from('posts')
            .insert([snakeData])
            .select('*')
            .single();

          if (error) {
            console.error('Supabase addPost error:', error.message, error.details, error.hint, error.code);
            throw error;
          }
          const camelPost = toCamel(data as Record<string, unknown>) as unknown as Post;
          set((s) => ({ posts: [camelPost, ...s.posts] }));

          // ── Notification for assigned PIC ──────────────────────────────
          const picValue = (post.pic ?? '').trim();
          const ideaText = (post.idea ?? '').trim() || 'Tanpa Judul';
          console.log('🔍 [addPost] PIC check:', { picValue, teamCount: get().teamMembers.length });
          if (picValue && picValue !== 'Unassigned' && get().notificationPrefs.assignment) {
            const team = get().teamMembers;
            const member = team.find(m => m.name === picValue);
            console.log('🔍 [addPost] Member found:', member ? { name: member.name, email: member.email } : 'NOT FOUND');
            if (member) {
              try {
                const notifRes = await fetch('/api/send-notification', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    workspaceId: get().activeWorkspaceId,
                    picName: picValue,
                    picEmail: member.email,
                    title: 'Tugas Baru! 📝',
                    message: `Kamu di-assign untuk konten: "${ideaText}"`,
                    type: 'assignment',
                    postId: camelPost.id,
                  }),
                });
                const notifData = await notifRes.json();
                console.log('✅ [addPost] Notification API response:', notifRes.status, notifData);
              } catch (err) {
                console.error('❌ [addPost] Notification API error:', err);
              }
            }
          }
        } catch (error) {
          console.error('Error adding post:', error);
        }
      },

      bulkAddPosts: async (posts) => {
        try {
          const wsId = get().activeWorkspaceId;
          if (!wsId) throw new Error('No active workspace');

          const snakePosts = posts.map(post => {
            const { created_at, ...rest } = post as any;
            return {
              ...toSnake(rest as unknown as Record<string, unknown>),
              workspace_id: wsId
            };
          });

          const { data, error } = await supabase
            .from('posts')
            .insert(snakePosts)
            .select('*');

          if (error) {
            console.error('Supabase bulkAddPosts error:', error.message, error.details, error.hint, error.code);
            throw error;
          }

          if (data) {
            const camelPosts = data.map(row => toCamel(row as Record<string, unknown>) as unknown as Post);
            set((s) => ({ posts: [...camelPosts, ...s.posts] }));
          }
        } catch (error) {
          console.error('Error bulk adding posts:', error);
        }
      },

      deletePost: async (id) => {
        try {
          const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', id);

          if (error) throw error;
          set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
        } catch (error) {
          console.error('Error deleting post:', error);
        }
      },

      bulkDeletePosts: async (ids) => {
        try {
          const { error } = await supabase
            .from('posts')
            .delete()
            .in('id', ids);

          if (error) throw error;
          set((s) => ({ posts: s.posts.filter((p) => !ids.includes(p.id)) }));
        } catch (error) {
          console.error('Error bulk deleting posts:', error);
        }
      },

      bulkUpdatePosts: async (ids, updates) => {
        try {
          // Map camelCase keys back to snake_case for Supabase
          const mappedUpdates: any = {};
          if (updates.idea !== undefined) mappedUpdates.idea = updates.idea;
          if (updates.pillar !== undefined) mappedUpdates.pillar = updates.pillar;
          if (updates.funnel !== undefined) mappedUpdates.funnel = updates.funnel;
          if (updates.type !== undefined) mappedUpdates.type = updates.type;
          if (updates.deadline !== undefined) mappedUpdates.deadline = updates.deadline;
          if (updates.postDate !== undefined) mappedUpdates.post_date = updates.postDate;
          if (updates.status !== undefined) mappedUpdates.status = updates.status;
          if (updates.assetLink !== undefined) {
            mappedUpdates.asset_link = updates.assetLink;
            mappedUpdates.gdrive_link = updates.assetLink;
          }
          if (updates.publishedLink !== undefined) mappedUpdates.published_link = updates.publishedLink;
          if (updates.script !== undefined) mappedUpdates.script = updates.script;
          if (updates.hook !== undefined) mappedUpdates.hook = updates.hook;
          if (updates.caption !== undefined) mappedUpdates.caption = updates.caption;
          if (updates.thumbnailUrl !== undefined) mappedUpdates.thumbnail_url = updates.thumbnailUrl;
          if (updates.pic !== undefined) mappedUpdates.pic = updates.pic;

          const { error } = await supabase
            .from('posts')
            .update(mappedUpdates)
            .in('id', ids);

          if (error) throw error;
          set((s) => ({
            posts: s.posts.map((p) => (ids.includes(p.id) ? { ...p, ...updates } : p)),
          }));
        } catch (error) {
          console.error('Error bulk updating posts:', error);
        }
      },

      updatePostStatus: async (id, status) => {
        try {
          const { error } = await supabase
            .from('posts')
            .update({ status })
            .eq('id', id);

          if (error) throw error;
          set((s) => ({
            posts: s.posts.map((p) => (p.id === id ? { ...p, status } : p)),
          }));
        } catch (error) {
          console.error('Error updating post status:', error);
        }
      },

      // ── Tags (workspace-specific, from Supabase) ────────────────────────

      pillars: [],
      contentTypes: [],
      funnels: [],
      statuses: [],

      fetchTags: async () => {
        try {
          const wsId = get().activeWorkspaceId;
          if (!wsId) {
            set({ pillars: defaultPillars, funnels: defaultFunnels, contentTypes: defaultContentTypes, statuses: defaultStatuses });
            return;
          }

          const { data, error } = await supabase
            .from('workspace_tags')
            .select('id, category, name, color, sort_order')
            .eq('workspace_id', wsId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

          if (error) throw error;

          const tags = data || [];

          // Auto-seed defaults for existing workspaces that have no tags yet
          if (tags.length === 0) {
            const defaultSeeds = [
              ...defaultPillars.map(t => ({ workspace_id: wsId, category: 'pillar', name: t.name, color: t.color })),
              ...defaultFunnels.map(t => ({ workspace_id: wsId, category: 'funnel', name: t.name, color: t.color })),
              ...defaultContentTypes.map(t => ({ workspace_id: wsId, category: 'contentType', name: t.name, color: t.color })),
              ...defaultStatuses.map(t => ({ workspace_id: wsId, category: 'status', name: t.name, color: t.color })),
            ];
            const { data: seeded } = await supabase.from('workspace_tags').insert(defaultSeeds).select('id, category, name, color');
            if (seeded && seeded.length > 0) {
              set({
                pillars: seeded.filter(t => t.category === 'pillar').map(t => ({ id: t.id, name: t.name, color: t.color })),
                funnels: seeded.filter(t => t.category === 'funnel').map(t => ({ id: t.id, name: t.name, color: t.color })),
                contentTypes: seeded.filter(t => t.category === 'contentType').map(t => ({ id: t.id, name: t.name, color: t.color })),
                statuses: seeded.filter(t => t.category === 'status').map(t => ({ id: t.id, name: t.name, color: t.color })),
              });
              return;
            }
          }

          set({
            pillars: tags.filter(t => t.category === 'pillar').map(t => ({ id: t.id, name: t.name, color: t.color })),
            funnels: tags.filter(t => t.category === 'funnel').map(t => ({ id: t.id, name: t.name, color: t.color })),
            contentTypes: tags.filter(t => t.category === 'contentType').map(t => ({ id: t.id, name: t.name, color: t.color })),
            statuses: tags.filter(t => t.category === 'status').map(t => ({ id: t.id, name: t.name, color: t.color })),
          });
        } catch (error) {
          console.warn('Error fetching workspace tags:', error);
          // Fallback to defaults
          set({ pillars: defaultPillars, funnels: defaultFunnels, contentTypes: defaultContentTypes, statuses: defaultStatuses });
        }
      },

      addPillar: async (name, color) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        const { data, error } = await supabase.from('workspace_tags').insert([{ workspace_id: wsId, category: 'pillar', name, color }]).select('id, name, color').single();
        if (!error && data) set((s) => ({ pillars: [...s.pillars, { id: data.id, name: data.name, color: data.color }] }));
      },
      deletePillar: async (id) => {
        const tag = get().pillars.find(p => p.id === id);
        await supabase.from('workspace_tags').delete().eq('id', id);
        set((s) => ({ pillars: s.pillars.filter((p) => p.id !== id) }));
        // Auto-clear posts using this tag
        if (tag) {
          const wsId = get().activeWorkspaceId;
          if (wsId) {
            await supabase.from('posts').update({ pillar: '' }).eq('workspace_id', wsId).eq('pillar', tag.name);
            set((s) => ({ posts: s.posts.map(p => p.pillar === tag.name ? { ...p, pillar: '' } : p) }));
          }
        }
      },

      addContentType: async (name, color) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        const { data, error } = await supabase.from('workspace_tags').insert([{ workspace_id: wsId, category: 'contentType', name, color }]).select('id, name, color').single();
        if (!error && data) set((s) => ({ contentTypes: [...s.contentTypes, { id: data.id, name: data.name, color: data.color }] }));
      },
      deleteContentType: async (id) => {
        const tag = get().contentTypes.find(t => t.id === id);
        await supabase.from('workspace_tags').delete().eq('id', id);
        set((s) => ({ contentTypes: s.contentTypes.filter((t) => t.id !== id) }));
        if (tag) {
          const wsId = get().activeWorkspaceId;
          if (wsId) {
            await supabase.from('posts').update({ type: '' }).eq('workspace_id', wsId).eq('type', tag.name);
            set((s) => ({ posts: s.posts.map(p => p.type === tag.name ? { ...p, type: '' } : p) }));
          }
        }
      },

      addFunnel: async (name, color) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        const { data, error } = await supabase.from('workspace_tags').insert([{ workspace_id: wsId, category: 'funnel', name, color }]).select('id, name, color').single();
        if (!error && data) set((s) => ({ funnels: [...s.funnels, { id: data.id, name: data.name, color: data.color }] }));
      },
      deleteFunnel: async (id) => {
        const tag = get().funnels.find(f => f.id === id);
        await supabase.from('workspace_tags').delete().eq('id', id);
        set((s) => ({ funnels: s.funnels.filter((f) => f.id !== id) }));
        if (tag) {
          const wsId = get().activeWorkspaceId;
          if (wsId) {
            await supabase.from('posts').update({ funnel: '' }).eq('workspace_id', wsId).eq('funnel', tag.name);
            set((s) => ({ posts: s.posts.map(p => p.funnel === tag.name ? { ...p, funnel: '' } : p) }));
          }
        }
      },

      addStatus: async (name, color) => {
        const wsId = get().activeWorkspaceId;
        if (!wsId) return;
        const { data, error } = await supabase.from('workspace_tags').insert([{ workspace_id: wsId, category: 'status', name, color }]).select('id, name, color').single();
        if (!error && data) set((s) => ({ statuses: [...s.statuses, { id: data.id, name: data.name, color: data.color }] }));
      },
      deleteStatus: async (id) => {
        const tag = get().statuses.find(s => s.id === id);
        await supabase.from('workspace_tags').delete().eq('id', id);
        set((s) => ({ statuses: s.statuses.filter((st) => st.id !== id) }));
        if (tag) {
          const wsId = get().activeWorkspaceId;
          if (wsId) {
            await supabase.from('posts').update({ status: '' }).eq('workspace_id', wsId).eq('status', tag.name);
            set((s) => ({ posts: s.posts.map(p => p.status === tag.name ? { ...p, status: '' } : p) }));
          }
        }
      },

      updateTag: async (id, name, color, category) => {
        const stateKey = category === 'pillar' ? 'pillars' : category === 'funnel' ? 'funnels' : category === 'contentType' ? 'contentTypes' : 'statuses';
        const postField = category === 'pillar' ? 'pillar' : category === 'funnel' ? 'funnel' : category === 'contentType' ? 'type' : 'status';
        // Find old tag name before updating
        const oldTag = (get()[stateKey] as TagDef[]).find(t => t.id === id);
        const oldName = oldTag?.name;

        const { error } = await supabase
          .from('workspace_tags')
          .update({ name, color })
          .eq('id', id);
        if (error) {
          console.error('Error updating tag:', error);
          return;
        }
        // Update tag in local state
        set((s) => ({
          [stateKey]: (s[stateKey] as TagDef[]).map((t) => t.id === id ? { ...t, name, color } : t),
        }));
        // If name changed, update all posts referencing the old name
        if (oldName && oldName !== name) {
          const wsId = get().activeWorkspaceId;
          if (wsId) {
            await supabase.from('posts').update({ [postField]: name }).eq('workspace_id', wsId).eq(postField, oldName);
            set((s) => ({
              posts: s.posts.map(p => (p as any)[postField] === oldName ? { ...p, [postField]: name } : p),
            }));
          }
        }
      },

      reorderTags: async (category, reorderedItems) => {
        const stateKey = category === 'pillar' ? 'pillars' : category === 'funnel' ? 'funnels' : category === 'contentType' ? 'contentTypes' : 'statuses';
        // Optimistic update
        set({ [stateKey]: reorderedItems });
        // Persist sort_order
        for (let i = 0; i < reorderedItems.length; i++) {
          await supabase
            .from('workspace_tags')
            .update({ sort_order: i })
            .eq('id', reorderedItems[i].id);
        }
      },

      teamMembers: [],
      currentUser: '',
      currentUserProfile: null,

      fetchCurrentUserProfile: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.email) return;
          const user = session.user;
          const email = user.email!;

          // 1. Core Profile Sync (Global discovery for invites)
          // Upsert into 'profiles' table which is used by the invite system
          const { error: profileSyncErr } = await supabase
            .from('profiles')
            .upsert([{
              id: user.id,
              email: email,
              updated_at: new Date().toISOString()
            }], { onConflict: 'id' });

          if (profileSyncErr) {
            console.warn('Profile sync error (non-fatal):', profileSyncErr);
          }

          // 2. Fetch team member data (Local to current workspace context)
          const { data, error } = await supabase
            .from('team_members')
            .select('name, email, role, avatar_url')
            .eq('email', email)
            .limit(1);

          if (data && data.length > 0) {
            const member = data[0];
            set({ currentUserProfile: { name: member.name, email: member.email, role: member.role, avatar_url: member.avatar_url || undefined } });
          } else {
            // No team_members entry — use email as fallback
            if (error) {
              console.warn('Notice fetching user profile:', error.message);
            }
            set({ currentUserProfile: { name: email.split('@')[0], email, role: '' } });
          }
        } catch (err) {
          console.warn('Notice fetching current user profile:', err);
        }
      },

      fetchTeamMembers: async () => {
        try {
          const wsId = get().activeWorkspaceId;
          if (!wsId) { set({ teamMembers: [] }); return; }

          // Fetch workspace_members for the active workspace
          const { data: wsMembers, error: wsErr } = await supabase
            .from('workspace_members')
            .select('id, user_name, role, created_at')
            .eq('workspace_id', wsId)
            .order('created_at', { ascending: true });
          if (wsErr) throw wsErr;

          if (wsMembers) {
            // Try to enrich with team_members names, fall back to email username
            const emails = wsMembers.map((m: any) => m.user_name);
            const { data: tmData } = await supabase
              .from('team_members')
              .select('name, email')
              .in('email', emails);

            const nameMap = new Map<string, string>();
            (tmData || []).forEach((tm: any) => nameMap.set(tm.email, tm.name));

            const members: TeamMember[] = wsMembers.map((m: any) => ({
              id: m.id,
              name: nameMap.get(m.user_name) || m.user_name.split('@')[0],
              email: m.user_name,
              role: m.role,
              created_at: m.created_at,
            }));

            set({ teamMembers: members });
          }
        } catch (error) {
          console.warn('Notice fetching team members:', error);
        }
      },

      addTeamMember: async (member) => {
        try {
          const { data, error } = await supabase
            .from('team_members')
            .insert([{ ...member }])
            .select('*')
            .single();
          if (error) throw error;
          if (data) set((s) => ({ teamMembers: [...s.teamMembers, data as TeamMember] }));
        } catch (error) {
          console.error('Error adding team member:', error);
        }
      },

      updateTeamMemberRole: async (id, role) => {
        try {
          const { error } = await supabase
            .from('team_members')
            .update({ role })
            .eq('id', id);
          if (error) throw error;
          set((s) => ({
            teamMembers: s.teamMembers.map((m) => (m.id === id ? { ...m, role } : m)),
          }));
        } catch (error) {
          console.error('Error updating team member role:', error);
        }
      },

      deleteTeamMember: async (id) => {
        try {
          const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('id', id);
          if (error) throw error;
          set((s) => ({ teamMembers: s.teamMembers.filter((m) => m.id !== id) }));
        } catch (error) {
          console.error('Error deleting team member:', error);
        }
      },

      activeSettingsTab: 'profile',
      setActiveSettingsTab: (tab) => set({ activeSettingsTab: tab }),

      // Notification preferences (persisted via zustand-persist + DB sync)
      notificationPrefs: {
        assignment: true,
        deadlineReminder: true,
        missedShare: true,
        ownerReport: true,
        postingReminder: true,
      },
      fetchNotificationPrefs: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) return;
          const res = await fetch(`/api/notification-prefs?userId=${session.user.id}`);
          if (!res.ok) return;
          const data = await res.json();
          set({
            notificationPrefs: {
              assignment: data.assignment ?? true,
              deadlineReminder: data.deadline_reminder ?? true,
              missedShare: data.missed_share ?? true,
              ownerReport: data.owner_report ?? true,
              postingReminder: data.posting_reminder ?? true,
            },
          });
        } catch (err) {
          console.warn('Failed to fetch notification prefs:', err);
        }
      },
      setNotificationPref: (key, value) => {
        // Optimistic local update
        set((s) => ({
          notificationPrefs: { ...s.notificationPrefs, [key]: value },
        }));
        // Sync to DB in background
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            const prefs = get().notificationPrefs;
            await fetch('/api/notification-prefs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: session.user.id,
                assignment: prefs.assignment,
                deadlineReminder: prefs.deadlineReminder,
                missedShare: prefs.missedShare,
                ownerReport: prefs.ownerReport,
                postingReminder: prefs.postingReminder,
              }),
            });
          } catch (err) {
            console.warn('Failed to sync notification pref to DB:', err);
          }
        })();
      },

      language: 'id' as Language,
      setLanguage: (lang) => set({ language: lang }),

      mobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
      toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),

      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'manaohq-storage-v2',
      storage: safeStorage,
      partialize: (state) => ({
        activeWorkspaceId: state.activeWorkspaceId,
        activeRole: state.activeRole,
        activeView: state.activeView,
        contentView: state.contentView,
        contentFilterYear: state.contentFilterYear,
        contentFilterMonth: state.contentFilterMonth,
        contentFilterWeek: state.contentFilterWeek,
        contentAssignedToMe: state.contentAssignedToMe,
        activeSettingsTab: state.activeSettingsTab,
        dashboardCards: state.dashboardCards,
        dashboardPresetRange: state.dashboardPresetRange,
        dashboardDateRange: state.dashboardDateRange,
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
        notificationPrefs: state.notificationPrefs,
        manualPostOrder: state.manualPostOrder,
      }),
    }
  )
);

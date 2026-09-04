import { supabase } from '../lib/supabase';
import { pushService } from './pushService';
import { emailService } from './emailService';

// Roles that should receive an article based on its audience.
function rolesFor(roleTarget: string): string[] {
  if (roleTarget === 'surrogate') return ['Surrogate', 'gestationalCarrier'];
  if (roleTarget === 'parent') return ['Intended Parent', 'intendedParent'];
  return ['Surrogate', 'gestationalCarrier', 'Intended Parent', 'intendedParent'];
}

// Notify the target audience that a new article was published.
async function pushNewArticle(title: string, roleTarget: string) {
  try {
    const { data } = await supabase
      .from('users')
      .select('id')
      .in('role', rolesFor(roleTarget));
    const ids = (data || []).map((u: { id: string }) => u.id);
    void pushService.send(ids, 'New article', title, { type: 'article' });
    void emailService.send(ids, 'New article', title, { type: 'article' });
  } catch (e) {
    console.error('article push failed', e);
  }
}

export type ArticleRoleTarget = 'surrogate' | 'parent' | 'both';

export interface Article {
  id: string;
  title: string;
  subtitle?: string | null;
  content: string;
  category?: string | null;
  iconName?: string | null;
  colorHex?: string | null;
  imageUrl?: string | null;
  mediaAssets?: { type: 'image' | 'video', url: string }[] | null;
  roleTarget: ArticleRoleTarget;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const TABLE = 'articles';

const fromDb = (r: any): Article => ({
  id: r.id,
  title: r.title,
  subtitle: r.subtitle,
  content: r.content ?? '',
  category: r.category,
  iconName: r.icon_name,
  colorHex: r.color_hex,
  imageUrl: r.image_url,
  mediaAssets: r.media_assets,
  roleTarget: (r.role_target ?? 'both') as ArticleRoleTarget,
  isPublished: !!r.is_published,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toDb = (a: Partial<Article>) => ({
  ...(a.title !== undefined ? { title: a.title } : {}),
  ...(a.subtitle !== undefined ? { subtitle: a.subtitle } : {}),
  ...(a.content !== undefined ? { content: a.content } : {}),
  ...(a.category !== undefined ? { category: a.category } : {}),
  ...(a.iconName !== undefined ? { icon_name: a.iconName } : {}),
  ...(a.colorHex !== undefined ? { color_hex: a.colorHex } : {}),
  ...(a.imageUrl !== undefined ? { image_url: a.imageUrl } : {}),
  ...(a.mediaAssets !== undefined ? { media_assets: a.mediaAssets } : {}),
  ...(a.roleTarget !== undefined ? { role_target: a.roleTarget } : {}),
  ...(a.isPublished !== undefined ? { is_published: a.isPublished } : {}),
});

export const articleService = {
  getArticles: async (): Promise<Article[]> => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  createArticle: async (a: Partial<Article>): Promise<string> => {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(toDb(a))
      .select('id')
      .single();
    if (error) throw error;
    if (a.isPublished && a.title) {
      void pushNewArticle(a.title, a.roleTarget ?? 'both');
    }
    return data.id;
  },

  updateArticle: async (id: string, a: Partial<Article>): Promise<void> => {
    const { error } = await supabase.from(TABLE).update(toDb(a)).eq('id', id);
    if (error) throw error;
  },

  setPublished: async (id: string, isPublished: boolean): Promise<void> => {
    const { error } = await supabase
      .from(TABLE)
      .update({ is_published: isPublished })
      .eq('id', id);
    if (error) throw error;
    if (isPublished) {
      const { data } = await supabase
        .from(TABLE)
        .select('title, role_target')
        .eq('id', id)
        .maybeSingle();
      if (data?.title) void pushNewArticle(data.title, data.role_target ?? 'both');
    }
  },

  deleteArticle: async (id: string): Promise<void> => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};

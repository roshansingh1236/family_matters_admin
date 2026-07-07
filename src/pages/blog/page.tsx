import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import Toast from '../../components/base/Toast';
import ConfirmationDialog from '../../components/base/ConfirmationDialog';
import { articleService, type Article, type ArticleRoleTarget } from '../../services/articleService';
import { formatMMDDYYYY } from '../../utils/dateFormat';
import { supabase } from '../../lib/supabase';

const ICONS = ['book', 'health', 'people', 'article'];
const CATEGORIES = ['Education', 'Health', 'Legal', 'Finance', 'Wellness', 'Community', 'News'];

const emptyDraft = (): Partial<Article> => ({
  title: '',
  subtitle: '',
  content: '',
  category: 'Education',
  iconName: 'book',
  colorHex: '3182CE',
  roleTarget: 'both',
  isPublished: false,
  mediaAssets: [],
});

const MediaCarousel = ({ mediaAssets }: { mediaAssets: { url: string; type: string }[] }) => {
  const [index, setIndex] = useState(0);

  if (!mediaAssets || mediaAssets.length === 0) return null;

  return (
    <div className="mb-4 -mt-4 -mx-4 h-48 relative bg-black group flex-shrink-0">
      {mediaAssets[index].type === 'image' ? (
        <div
          className="w-full h-full relative cursor-pointer group/image"
          onClick={() => window.open(mediaAssets[index].url, '_blank')}
        >
          <img src={mediaAssets[index].url} alt="Cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
            <i className="ri-search-eye-line text-4xl text-white drop-shadow-md"></i>
          </div>
        </div>
      ) : (
        <video src={mediaAssets[index].url} className="w-full h-full object-contain" controls controlsList="nodownload" />
      )}

      {mediaAssets.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex(i => i > 0 ? i - 1 : mediaAssets.length - 1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
          >
            <i className="ri-arrow-left-s-line text-lg"></i>
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex(i => i < mediaAssets.length - 1 ? i + 1 : 0); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
          >
            <i className="ri-arrow-right-s-line text-lg"></i>
          </button>

          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-lg">
            {index + 1} / {mediaAssets.length}
          </div>
        </>
      )}
    </div>
  );
};

const BlogPage: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft'>('all');

  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState<Partial<Article>>(emptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      setArticles(await articleService.getArticles());
    } catch (e) {
      setArticles([]);
      setToast({ message: 'Failed to load articles', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === 'published') return articles.filter(a => a.isPublished);
    if (activeTab === 'draft') return articles.filter(a => !a.isPublished);
    return articles;
  }, [articles, activeTab]);

  const openNew = () => {
    setDraft(emptyDraft());
    setShowEditor(true);
  };

  const openEdit = (a: Article) => {
    setDraft({ ...a });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!draft.title?.trim()) {
      setToast({ message: 'Title is required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      if (draft.id) {
        await articleService.updateArticle(draft.id, draft);
        setToast({ message: 'Article updated', type: 'success' });
      } else {
        await articleService.createArticle(draft);
        setToast({ message: 'Article created', type: 'success' });
      }
      setShowEditor(false);
      await fetchArticles();
    } catch (e: any) {
      setToast({ message: e.message || 'Failed to save', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newAssets: { type: 'image' | 'video', url: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const { error } = await supabase.storage
          .from('articles_media')
          .upload(fileName, file);

        if (error) throw error;

        const { data: publicData } = supabase.storage
          .from('articles_media')
          .getPublicUrl(fileName);

        const type = file.type.startsWith('video/') ? 'video' : 'image';
        newAssets.push({ type, url: publicData.publicUrl });
      }

      setDraft(prev => ({
        ...prev,
        mediaAssets: [...(prev.mediaAssets || []), ...newAssets]
      }));
      setToast({ message: 'Media uploaded successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: 'Failed to upload media', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const togglePublish = async (a: Article) => {
    try {
      await articleService.setPublished(a.id, !a.isPublished);
      setArticles(prev => prev.map(x => x.id === a.id ? { ...x, isPublished: !a.isPublished } : x));
    } catch {
      setToast({ message: 'Failed to update', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await articleService.deleteArticle(deleteId);
      setArticles(prev => prev.filter(a => a.id !== deleteId));
      setToast({ message: 'Article deleted', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete', type: 'error' });
    } finally {
      setDeleteId(null);
    }
  };

  const roleBadge = (r: ArticleRoleTarget) =>
    r === 'both' ? <Badge color="indigo">All users</Badge>
      : r === 'surrogate' ? <Badge color="purple">Surrogates</Badge>
        : <Badge color="blue">Parents</Badge>;

  const field = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-rose-500 outline-none";

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0e0b1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Blog & Resources</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium">Write articles for surrogates and intended parents in the app.</p>
            </div>
            <Button color="blue" onClick={openNew}><i className="ri-add-line mr-2"></i> New Article</Button>
          </div>

          <div className="flex gap-2 mb-6">
            {(['all', 'published', 'draft'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-bold capitalize ${activeTab === t ? 'bg-rose-500 text-white' : 'bg-white dark:bg-white/5 text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64"><i className="ri-loader-4-line text-4xl animate-spin text-rose-500"></i></div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2">
              <i className="ri-article-line text-4xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No articles yet</h3>
              <p className="text-sm text-gray-500 mt-1">Create your first blog article for the app.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map(a => (
                <Card key={a.id} className="flex flex-col overflow-hidden">
                  <MediaCarousel mediaAssets={a.mediaAssets || []} />
                  <div className="flex items-start justify-between mb-3 mt-4">
                    <Badge color={a.isPublished ? 'green' : 'gray'}>{a.isPublished ? 'Published' : 'Draft'}</Badge>
                    {roleBadge(a.roleTarget)}
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-snug">{a.title}</h3>
                  {a.subtitle && <p className="text-sm text-gray-500 mt-1">{a.subtitle}</p>}
                  <p className="text-xs text-gray-400 mt-3 line-clamp-3 flex-1">{a.content}</p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    <span className="text-[10px] uppercase font-bold text-gray-400">{a.category || '—'} · {a.createdAt ? formatMMDDYYYY(a.createdAt) : ''}</span>
                    <div className="flex gap-1">
                      <button title={a.isPublished ? 'Unpublish' : 'Publish'} onClick={() => togglePublish(a)}
                        className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                        <i className={a.isPublished ? 'ri-eye-off-line' : 'ri-send-plane-line'}></i>
                      </button>
                      <button title="Edit" onClick={() => openEdit(a)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"><i className="ri-edit-line"></i></button>
                      <button title="Delete" onClick={() => setDeleteId(a.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><i className="ri-delete-bin-line"></i></button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {showEditor && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
              <div className="bg-white dark:bg-[#15111f] rounded-[2rem] max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-rose-100/20 dark:border-white/5">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{draft.id ? 'Edit Article' : 'New Article'}</h2>
                  <button onClick={() => setShowEditor(false)} className="w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center text-gray-500"><i className="ri-close-line text-xl"></i></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Title</label>
                    <input className={field} value={draft.title || ''} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Article title" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Subtitle</label>
                    <input className={field} value={draft.subtitle || ''} onChange={e => setDraft({ ...draft, subtitle: e.target.value })} placeholder="Short summary" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Audience</label>
                      <select className={field} value={draft.roleTarget} onChange={e => setDraft({ ...draft, roleTarget: e.target.value as ArticleRoleTarget })}>
                        <option value="both">All users</option>
                        <option value="surrogate">Surrogates</option>
                        <option value="parent">Parents</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Category</label>
                      <select className={field} value={draft.category || ''} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Icon</label>
                      <select className={field} value={draft.iconName || 'book'} onChange={e => setDraft({ ...draft, iconName: e.target.value })}>
                        {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">Content</label>
                    <textarea className={field} rows={10} value={draft.content || ''} onChange={e => setDraft({ ...draft, content: e.target.value })} placeholder="Write the article…" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5 flex justify-between items-center">
                      Media Slides (Images & Videos)
                      <label className="text-blue-500 cursor-pointer hover:underline normal-case flex items-center gap-1">
                        <i className="ri-upload-2-line"></i> Upload Files
                        <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} disabled={isUploading} />
                      </label>
                    </label>
                    {isUploading && <div className="text-xs text-blue-500 mb-3"><i className="ri-loader-4-line animate-spin mr-1"></i> Uploading...</div>}
                    {draft.mediaAssets && draft.mediaAssets.length > 0 && (
                      <div className="flex gap-3 overflow-x-auto pb-3 custom-scrollbar">
                        {draft.mediaAssets.map((m, idx) => (
                          <div key={idx} className="relative w-28 h-28 rounded-lg bg-gray-100 dark:bg-white/5 flex-shrink-0 overflow-hidden border border-gray-200 dark:border-white/10 group">
                            {m.type === 'image' ? (
                              <img src={m.url} alt="Slide" className="w-full h-full object-cover" />
                            ) : (
                              <video src={m.url} className="w-full h-full object-cover" />
                            )}
                            <button onClick={() => setDraft(prev => ({ ...prev, mediaAssets: prev.mediaAssets?.filter((_, i) => i !== idx) }))}
                              className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <i className="ri-close-line text-sm"></i>
                            </button>
                            {m.type === 'video' && <div className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded flex items-center gap-1"><i className="ri-video-line"></i> Video</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input type="checkbox" checked={!!draft.isPublished} onChange={e => setDraft({ ...draft, isPublished: e.target.checked })} className="w-4 h-4 accent-rose-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Publish immediately (visible in the app)</span>
                  </label>
                </div>
                <div className="p-6 border-t border-gray-100 dark:border-white/5 flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
                  <Button color="blue" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <i className="ri-loader-4-line animate-spin mr-2"></i> : <i className="ri-save-line mr-2"></i>}
                    {draft.id ? 'Save changes' : 'Create article'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <ConfirmationDialog
            isOpen={!!deleteId}
            onClose={() => setDeleteId(null)}
            onConfirm={() => void handleDelete()}
            title="Delete article?"
            message="This permanently removes the article from the app."
            confirmLabel="Delete"
            isDestructive
          />

          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </main>
      </div>
    </div>
  );
};

export default BlogPage;

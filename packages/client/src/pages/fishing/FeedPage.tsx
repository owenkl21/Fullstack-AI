import axios from 'axios';
import { Show } from '@clerk/react';
import { useEffect, useState } from 'react';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type FeedPost = {
   id: string;
   type: 'CATCH' | 'SITE';
   scope: 'GLOBAL' | 'NEARBY';
   content: string | null;
   likeCount: number;
   commentCount: number;
   likedByMe: boolean;
   catch: {
      id: string;
      title: string;
      images: Array<{ image: { id: string; url: string } }>;
   } | null;
   site: {
      id: string;
      name: string;
      images: Array<{ image: { id: string; url: string } }>;
   } | null;
   author: { displayName: string; username: string };
   comments: Array<{
      id: string;
      body: string;
      user: { displayName: string; username: string };
   }>;
};

export function FeedPage() {
   const pageSize = 25;
   const [posts, setPosts] = useState<FeedPost[]>([]);
   const [scope, setScope] = useState<'GLOBAL' | 'NEARBY'>('GLOBAL');
   const [type, setType] = useState<'ALL' | 'CATCH' | 'SITE'>('ALL');
   const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
      {}
   );
   const [expandedComments, setExpandedComments] = useState<
      Record<string, boolean>
   >({});
   const [offset, setOffset] = useState(0);
   const [hasMore, setHasMore] = useState(true);
   const [isLoading, setIsLoading] = useState(false);
   const [isLoadingMore, setIsLoadingMore] = useState(false);

   const load = async (input?: { reset?: boolean }) => {
      const reset = Boolean(input?.reset);
      const targetOffset = reset ? 0 : offset;

      try {
         if (reset) {
            setIsLoading(true);
         } else {
            setIsLoadingMore(true);
         }

         const params: Record<string, string | number> = {
            scope,
            limit: pageSize,
            offset: targetOffset,
         };
         if (type !== 'ALL') {
            params.type = type;
         }

         if (scope === 'NEARBY' && navigator.geolocation) {
            await new Promise<void>((resolve) => {
               navigator.geolocation.getCurrentPosition(
                  (position) => {
                     params.latitude = position.coords.latitude;
                     params.longitude = position.coords.longitude;
                     resolve();
                  },
                  () => resolve(),
                  { enableHighAccuracy: false, timeout: 1500 }
               );
            });
         }

         const { data } = await axios.get('/api/feed', { params });
         const nextPosts = data.posts ?? [];

         if (reset) {
            setPosts(nextPosts);
         } else {
            setPosts((prev) => [...prev, ...nextPosts]);
         }

         setOffset(data.nextOffset ?? targetOffset + nextPosts.length);
         setHasMore(Boolean(data.hasMore));
      } catch (error) {
         console.error(error);
         toast({ title: 'Unable to load feed', variant: 'error' });
      } finally {
         if (reset) {
            setIsLoading(false);
         } else {
            setIsLoadingMore(false);
         }
      }
   };

   useEffect(() => {
      setOffset(0);
      setHasMore(true);
      void load({ reset: true });
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [scope, type]);

   useEffect(() => {
      if (!hasMore || isLoading || isLoadingMore) {
         return;
      }

      const onScroll = () => {
         const scrollBottom =
            window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 500;

         if (scrollBottom) {
            void load();
         }
      };

      window.addEventListener('scroll', onScroll);
      return () => window.removeEventListener('scroll', onScroll);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [hasMore, isLoading, isLoadingMore, offset, scope, type]);

   const like = async (postId: string) => {
      await axios.post(`/api/feed/${postId}/likes`);
      setOffset(0);
      setHasMore(true);
      await load({ reset: true });
   };

   const comment = async (postId: string) => {
      const body = commentDrafts[postId]?.trim();
      if (!body) return;
      await axios.post(`/api/feed/${postId}/comments`, { body });
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      setExpandedComments((prev) => ({ ...prev, [postId]: true }));
      setOffset(0);
      setHasMore(true);
      await load({ reset: true });
   };

   const toggleComments = (postId: string) => {
      setExpandedComments((prev) => ({
         ...prev,
         [postId]: !prev[postId],
      }));
   };

   return (
      <div className="min-h-screen">
         <LandingHeader />
         <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <FishingActionBar />
            <section className="space-y-3 rounded-lg border p-4">
               <h1 className="text-2xl font-semibold">Feed</h1>
               <div className="flex flex-wrap gap-2">
                  <Button
                     variant={scope === 'GLOBAL' ? 'default' : 'outline'}
                     onClick={() => setScope('GLOBAL')}
                  >
                     Global
                  </Button>
                  <Button
                     variant={scope === 'NEARBY' ? 'default' : 'outline'}
                     onClick={() => setScope('NEARBY')}
                  >
                     Near me
                  </Button>
                  <Button
                     variant={type === 'ALL' ? 'default' : 'outline'}
                     onClick={() => setType('ALL')}
                  >
                     All
                  </Button>
                  <Button
                     variant={type === 'CATCH' ? 'default' : 'outline'}
                     onClick={() => setType('CATCH')}
                  >
                     Catch feed
                  </Button>
                  <Button
                     variant={type === 'SITE' ? 'default' : 'outline'}
                     onClick={() => setType('SITE')}
                  >
                     Site feed
                  </Button>
               </div>

               <Show when="signed-in">
                  <p className="rounded border p-3 text-sm text-muted-foreground">
                     Your feed posts are created when you log a catch or log a
                     fishing site.
                  </p>
               </Show>

               <div className="space-y-3">
                  {posts.map((post) => {
                     const postImages = [
                        ...(post.catch?.images ?? []),
                        ...(post.site?.images ?? []),
                     ];
                     const commentsOpen = Boolean(expandedComments[post.id]);

                     return (
                        <article
                           key={post.id}
                           className="space-y-2 rounded border p-3"
                        >
                           <p className="text-sm text-muted-foreground">
                              {post.author.displayName} @{post.author.username}{' '}
                              • {post.type} • {post.scope}
                           </p>
                           <p>{post.content ?? 'No text'}</p>
                           {post.catch ? (
                              <p className="text-sm">
                                 Catch: {post.catch.title}
                              </p>
                           ) : null}
                           {post.site ? (
                              <p className="text-sm">Site: {post.site.name}</p>
                           ) : null}

                           {postImages.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                 {postImages.map((entry) => (
                                    <img
                                       key={entry.image.id}
                                       src={entry.image.url}
                                       alt="Post"
                                       className="aspect-[4/3] w-full rounded object-cover"
                                       loading="lazy"
                                    />
                                 ))}
                              </div>
                           ) : null}

                           <div className="flex gap-2">
                              <Button
                                 size="sm"
                                 variant={
                                    post.likedByMe ? 'default' : 'outline'
                                 }
                                 onClick={() => void like(post.id)}
                              >
                                 Like ({post.likeCount})
                              </Button>
                              <Button
                                 size="sm"
                                 variant={commentsOpen ? 'default' : 'outline'}
                                 onClick={() => toggleComments(post.id)}
                              >
                                 Comments ({post.commentCount})
                              </Button>
                           </div>

                           {commentsOpen ? (
                              <>
                                 <div className="space-y-1">
                                    {post.comments.map((entry) => (
                                       <p key={entry.id} className="text-sm">
                                          {entry.user.displayName}: {entry.body}
                                       </p>
                                    ))}
                                    {post.comments.length === 0 ? (
                                       <p className="text-sm text-muted-foreground">
                                          No comments yet.
                                       </p>
                                    ) : null}
                                 </div>
                                 <Show when="signed-in">
                                    <div className="flex gap-2">
                                       <input
                                          className="flex-1 rounded border px-2 py-1"
                                          value={commentDrafts[post.id] ?? ''}
                                          onChange={(event) =>
                                             setCommentDrafts((prev) => ({
                                                ...prev,
                                                [post.id]: event.target.value,
                                             }))
                                          }
                                          placeholder="Add comment"
                                       />
                                       <Button
                                          size="sm"
                                          onClick={() => void comment(post.id)}
                                       >
                                          Send
                                       </Button>
                                    </div>
                                 </Show>
                              </>
                           ) : null}
                        </article>
                     );
                  })}
               </div>

               {isLoading ? (
                  <p className="text-sm text-muted-foreground">
                     Loading feed...
                  </p>
               ) : null}
               {isLoadingMore ? (
                  <p className="text-sm text-muted-foreground">
                     Loading more posts...
                  </p>
               ) : null}
               {!hasMore && posts.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                     You reached the end of the feed.
                  </p>
               ) : null}
            </section>
         </main>
      </div>
   );
}

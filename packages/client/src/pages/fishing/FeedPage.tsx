import axios from 'axios';
import { Show } from '@clerk/react';
import {
   MessageCircle,
   SendHorizontal,
   SlidersHorizontal,
   ThumbsUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FishingActionBar } from '@/components/fishing/FishingActionBar';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
   Carousel,
   CarouselContent,
   CarouselItem,
   CarouselNext,
   CarouselPrevious,
} from '@/components/ui/carousel';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/components/ui/use-toast';

type FeedPost = {
   id: string;
   type: 'CATCH' | 'SITE';
   scope: 'GLOBAL' | 'NEARBY';
   content: string | null;
   likeCount: number;
   commentCount: number;
   likedByMe: boolean;
   latitude?: number | null;
   longitude?: number | null;
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

function distanceInKm(
   origin: { latitude: number; longitude: number },
   target: { latitude: number; longitude: number }
) {
   const toRad = (value: number) => (value * Math.PI) / 180;
   const radius = 6371;
   const dLat = toRad(target.latitude - origin.latitude);
   const dLon = toRad(target.longitude - origin.longitude);
   const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(origin.latitude)) *
         Math.cos(toRad(target.latitude)) *
         Math.sin(dLon / 2) *
         Math.sin(dLon / 2);

   return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function FeedPage() {
   const pageSize = 25;
   const [posts, setPosts] = useState<FeedPost[]>([]);
   const [scope, setScope] = useState<'GLOBAL' | 'NEARBY'>('GLOBAL');
   const [type, setType] = useState<'ALL' | 'CATCH' | 'SITE'>('ALL');
   const [radiusKm, setRadiusKm] = useState(50);
   const [currentPosition, setCurrentPosition] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   const [locationError, setLocationError] = useState<string | null>(null);
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
            scope: scope === 'NEARBY' ? 'GLOBAL' : scope,
            limit: pageSize,
            offset: targetOffset,
         };
         if (type !== 'ALL') {
            params.type = type;
         }

         if (scope === 'NEARBY') {
            if (!navigator.geolocation) {
               setCurrentPosition(null);
               setLocationError(
                  'Geolocation is not available in this browser.'
               );
            } else {
               await new Promise<void>((resolve) => {
                  navigator.geolocation.getCurrentPosition(
                     (position) => {
                        const coords = {
                           latitude: position.coords.latitude,
                           longitude: position.coords.longitude,
                        };
                        params.latitude = coords.latitude;
                        params.longitude = coords.longitude;
                        setCurrentPosition(coords);
                        setLocationError(null);
                        resolve();
                     },
                     () => {
                        setCurrentPosition(null);
                        setLocationError(
                           'We could not access your location. Enable location access to use Local radius filtering.'
                        );
                        resolve();
                     },
                     { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                  );
               });
            }
         } else {
            setLocationError(null);
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

   const visiblePosts = useMemo(() => {
      if (scope !== 'NEARBY') {
         return posts;
      }

      if (!currentPosition) {
         return [];
      }

      return posts.filter((post) => {
         if (
            typeof post.latitude !== 'number' ||
            typeof post.longitude !== 'number'
         ) {
            return false;
         }

         return (
            distanceInKm(currentPosition, {
               latitude: post.latitude,
               longitude: post.longitude,
            }) <= radiusKm
         );
      });
   }, [currentPosition, posts, radiusKm, scope]);

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
            <section className="space-y-4 rounded-2xl border bg-card/70 p-4 shadow-sm backdrop-blur-sm">
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
                     Local
                  </Button>
                  <Button
                     variant={type === 'ALL' ? 'default' : 'outline'}
                     onClick={() => setType('ALL')}
                  >
                     All feed
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

               {scope === 'NEARBY' ? (
                  <div className="rounded-lg border bg-background p-4">
                     <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                           <SlidersHorizontal className="size-4" />
                           Local radius
                        </span>
                        <span>{radiusKm} km</span>
                     </div>
                     <Slider
                        min={0}
                        max={250}
                        step={1}
                        value={[radiusKm]}
                        onValueChange={(value) => setRadiusKm(value[0] ?? 0)}
                     />
                     {locationError ? (
                        <p className="mt-2 text-sm text-destructive">
                           {locationError}
                        </p>
                     ) : null}
                  </div>
               ) : null}

               <Show when="signed-in">
                  <p className="rounded border p-3 text-sm text-muted-foreground">
                     Your feed posts are created when you log a catch or log a
                     fishing site.
                  </p>
               </Show>

               <div className="space-y-5">
                  {visiblePosts.map((post) => {
                     const postImages = [
                        ...(post.catch?.images ?? []),
                        ...(post.site?.images ?? []),
                     ];
                     const commentsOpen = Boolean(expandedComments[post.id]);

                     return (
                        <Card
                           key={post.id}
                           className="overflow-hidden gap-0 py-0"
                        >
                           <CardContent className="space-y-3 p-0">
                              <div className="flex items-center justify-between px-4 pt-4">
                                 <p className="text-sm font-medium">
                                    {post.author.displayName}
                                    <span className="ml-1 text-muted-foreground">
                                       @{post.author.username}
                                    </span>
                                 </p>
                                 <p className="text-xs text-muted-foreground">
                                    {post.type} • {post.scope}
                                 </p>
                              </div>

                              {postImages.length > 0 ? (
                                 <div className="bg-muted/20 px-4">
                                    <Carousel className="mx-auto w-full max-w-3xl">
                                       <CarouselContent className="ml-0">
                                          {postImages.map((entry) => (
                                             <CarouselItem
                                                key={entry.image.id}
                                                className="pl-0"
                                             >
                                                <div className="relative h-64 w-full overflow-hidden bg-muted sm:h-[32rem]">
                                                   <img
                                                      src={entry.image.url}
                                                      alt="Post"
                                                      className="h-full w-full object-cover"
                                                      loading="lazy"
                                                   />
                                                </div>
                                             </CarouselItem>
                                          ))}
                                       </CarouselContent>
                                       {postImages.length > 1 ? (
                                          <>
                                             <CarouselPrevious className="left-2 border-background/80 bg-background/90 hover:bg-background" />
                                             <CarouselNext className="right-2 border-background/80 bg-background/90 hover:bg-background" />
                                          </>
                                       ) : null}
                                    </Carousel>
                                 </div>
                              ) : null}

                              <div className="space-y-2 px-4 pb-4">
                                 <p className="text-sm leading-relaxed">
                                    {post.content ?? 'No text'}
                                 </p>
                                 {post.catch ? (
                                    <p className="text-sm text-muted-foreground">
                                       Catch: {post.catch.title}
                                    </p>
                                 ) : null}
                                 {post.site ? (
                                    <p className="text-sm text-muted-foreground">
                                       Site: {post.site.name}
                                    </p>
                                 ) : null}

                                 <div className="flex items-center gap-4 border-y py-2">
                                    <Button
                                       size="sm"
                                       variant="ghost"
                                       className={
                                          post.likedByMe ? 'text-primary' : ''
                                       }
                                       onClick={() => void like(post.id)}
                                    >
                                       <ThumbsUp className="size-4" />
                                       Like
                                    </Button>
                                    <Button
                                       size="sm"
                                       variant="ghost"
                                       className={
                                          commentsOpen ? 'text-primary' : ''
                                       }
                                       onClick={() => toggleComments(post.id)}
                                    >
                                       <MessageCircle className="size-4" />
                                       Comment
                                    </Button>
                                 </div>

                                 <p className="text-xs text-muted-foreground">
                                    {post.commentCount} comments •{' '}
                                    {post.likeCount} likes
                                 </p>

                                 {commentsOpen ? (
                                    <>
                                       <div className="space-y-2">
                                          {post.comments.map((entry) => (
                                             <p
                                                key={entry.id}
                                                className="text-sm"
                                             >
                                                <span className="font-medium">
                                                   {entry.user.displayName}:
                                                </span>{' '}
                                                {entry.body}
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
                                                className="flex-1 rounded-full border px-3 py-2 text-sm"
                                                value={
                                                   commentDrafts[post.id] ?? ''
                                                }
                                                onChange={(event) =>
                                                   setCommentDrafts((prev) => ({
                                                      ...prev,
                                                      [post.id]:
                                                         event.target.value,
                                                   }))
                                                }
                                                placeholder="Add comment"
                                             />
                                             <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() =>
                                                   void comment(post.id)
                                                }
                                             >
                                                <SendHorizontal className="size-4" />
                                             </Button>
                                          </div>
                                       </Show>
                                    </>
                                 ) : null}
                              </div>
                           </CardContent>
                        </Card>
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
               {visiblePosts.length === 0 && !isLoading ? (
                  <p className="text-sm text-muted-foreground">
                     {scope === 'NEARBY'
                        ? 'No posts found inside this radius yet.'
                        : 'No feed posts found.'}
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

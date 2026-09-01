import {create} from 'zustand';
import type {Post} from '../core/types/models';

interface SocialState {
  feed: Post[];
  myPosts: Post[];
  savedPosts: Post[];
  isLoading: boolean;
  hasMore: boolean;
  lastCursor: string | null;

  setFeed: (posts: Post[]) => void;
  appendFeed: (posts: Post[]) => void;
  addPost: (post: Post) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
  removePost: (postId: string) => void;
  setMyPosts: (posts: Post[]) => void;
  setSavedPosts: (posts: Post[]) => void;
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setLastCursor: (cursor: string | null) => void;
}

export const useSocialStore = create<SocialState>((set) => ({
  feed: [],
  myPosts: [],
  savedPosts: [],
  isLoading: false,
  hasMore: true,
  lastCursor: null,

  setFeed: (feed) => set({feed}),
  appendFeed: (posts) =>
    set((state) => ({
      feed: [...state.feed, ...posts.filter((p) => !state.feed.some((f) => f.id === p.id))],
    })),
  addPost: (post) =>
    set((state) => ({
      feed: [post, ...state.feed],
      myPosts: [post, ...state.myPosts],
    })),
  updatePost: (postId, updates) =>
    set((state) => ({
      feed: state.feed.map((p) => (p.id === postId ? {...p, ...updates} : p)),
      myPosts: state.myPosts.map((p) => (p.id === postId ? {...p, ...updates} : p)),
    })),
  removePost: (postId) =>
    set((state) => ({
      feed: state.feed.filter((p) => p.id !== postId),
      myPosts: state.myPosts.filter((p) => p.id !== postId),
    })),
  setMyPosts: (myPosts) => set({myPosts}),
  setSavedPosts: (savedPosts) => set({savedPosts}),
  toggleLike: (postId) =>
    set((state) => ({
      feed: state.feed.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLikedByMe: !p.isLikedByMe,
              likeCount: p.isLikedByMe ? p.likeCount - 1 : p.likeCount + 1,
            }
          : p,
      ),
    })),
  toggleSave: (postId) =>
    set((state) => ({
      feed: state.feed.map((p) =>
        p.id === postId ? {...p, isSavedByMe: !p.isSavedByMe} : p,
      ),
    })),
  setLoading: (isLoading) => set({isLoading}),
  setHasMore: (hasMore) => set({hasMore}),
  setLastCursor: (lastCursor) => set({lastCursor}),
}));

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

export type CommentTargetType = "voucher";

export interface AppComment {
  id: string;
  companyId: string;
  targetType: CommentTargetType;
  targetId: string;
  targetLabel: string;
  text: string;
  createdAt: string;
  createdBy?: string;
}

interface CommentsContextType {
  comments: AppComment[];
  addComment: (comment: Omit<AppComment, "id" | "companyId" | "createdAt" | "createdBy">) => AppComment | null;
  deleteComment: (commentId: string) => void;
  getCommentsForTarget: (targetType: CommentTargetType, targetId: string) => AppComment[];
}

const CommentsContext = createContext<CommentsContextType | undefined>(undefined);
const COMMENT_KEY_PREFIX = "accountpro_comments_";

export function CommentsProvider({ children }: { children: ReactNode }) {
  const { activeCompany, user } = useAuth();
  const companyId = activeCompany?.id || "";
  const [comments, setComments] = useState<AppComment[]>([]);

  const storageKey = useMemo(() => companyId ? `${COMMENT_KEY_PREFIX}${companyId}` : "", [companyId]);

  useEffect(() => {
    if (!storageKey) {
      setComments([]);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      setComments(stored ? JSON.parse(stored) : []);
    } catch {
      setComments([]);
    }
  }, [storageKey]);

  const persistComments = (nextComments: AppComment[]) => {
    setComments(nextComments);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(nextComments));
    }
  };

  const addComment: CommentsContextType["addComment"] = (comment) => {
    if (!companyId) return null;

    const nextComment: AppComment = {
      ...comment,
      id: crypto.randomUUID(),
      companyId,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || user?.email,
    };

    persistComments([nextComment, ...comments]);
    return nextComment;
  };

  const deleteComment = (commentId: string) => {
    persistComments(comments.filter((comment) => comment.id !== commentId));
  };

  const getCommentsForTarget = (targetType: CommentTargetType, targetId: string) => (
    comments.filter((comment) => comment.targetType === targetType && comment.targetId === targetId)
  );

  return (
    <CommentsContext.Provider value={{ comments, addComment, deleteComment, getCommentsForTarget }}>
      {children}
    </CommentsContext.Provider>
  );
}

export function useComments() {
  const context = useContext(CommentsContext);
  if (!context) {
    throw new Error("useComments must be used within CommentsProvider");
  }
  return context;
}

export type PublicTag = { id: string; slug: string; name: string };

export type PublicWorkflowSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  baseModel: string;
  comfyVersion: string;
  authorDisplayName: string | null;
  uniqueDownloadCount: number;
  averageRating: number;
  reviewCount: number;
  publishedAt: string | null;
  updatedAt: string;
  tags: PublicTag[];
};

export type PublicWorkflowListResponse = {
  workflows: PublicWorkflowSummary[];
  page: number;
  pageSize: number;
  total: number;
};

export type ApiErrorBody = {
  error?: string;
  issues?: { path: string; message: string }[];
};

export type SuggestionKind = "base_model" | "comfy_version";

export type CatalogSuggestionApiKind = SuggestionKind | "tag";

export type SuggestionItem = { value: string; label?: string };

export type TagChip = { needle: string; label?: string };
